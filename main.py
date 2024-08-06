from fastapi import FastAPI, Request, HTTPException, WebSocket, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from datetime import datetime
from openai import AsyncClient as OpenAI
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.websockets import WebSocketDisconnect
import bcrypt
import asyncio

import json

#import spacy
#nlp = spacy.load("ru_core_news_lg")


# Mongo
client = AsyncIOMotorClient('mongodb://localhost:27017/')
db = client['TestMyBase']


app = FastAPI()
client = OpenAI(api_key="") # Api Key


# Корс
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Для фронта
app.mount("/static", StaticFiles(directory="front", html=True), name="static")


# ---- [ Основной функционал ] ----

# Отправка сообщения
class UserTextRequest(BaseModel):
    id: int
    text: str

@app.post("/api/send-text")
async def openai_response(request_data: UserTextRequest):
    user_id = request_data.id
    text_from_user = request_data.text.replace('\n', '')

    user_data = await db.users.find_one({"user_id": user_id})

    # Создание юзера
    if not user_data:
        user_data = {
            "user_id": user_id,
            "history": [],
            "context": []
        }
        await db.users.insert_one(user_data)

    # Формирование сообщения
    context_list = user_data.get("context", [])
    req_messages = []

    if len(context_list):
        for context in context_list:
            req_messages.append({
                "role": "system",
                "content": context
            })

    req_messages.append({
        "role": "user",
        "content": text_from_user
    })

    # Запрос GPT
    response = await client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=req_messages
    )

    message = response.choices[0].message.content


    # Сообщение юзера в базу
    message_entry = {
        "role": "user",
        "content": text_from_user,
        "timestamp": datetime.now().isoformat()
    }
    await db.users.update_one({"user_id":user_id}, {"$push": {"history":message_entry}})

    # Контекст Юзера
    await db.users.update_one(
        {"user_id": user_id},
        {"$push": {
            "context": {
                "$each": ["user:" + text_from_user],
                "$slice": -4
            }
        }}
    )


    # Ответ GTP в базу
    response_entry = {
        "role": "assistant",
        "content": message,
        "timestamp": datetime.now().isoformat()
    }
    await db.users.update_one({"user_id": user_id}, {"$push": {"history": response_entry}})

    # Контекст GTP
    await db.users.update_one({"user_id": user_id}, {"$push": {"context": "assistant:"+message}})


    return JSONResponse(
        content={
            "message": {
                "content": message,
                "timestamp": datetime.now().isoformat()
            }
        })

# Login
@app.post("/api/login")
async def login_user(id: int = Body(...), password: str = Body(...)):
    user_collection = db.users
    user_data = await user_collection.find_one({"user_id": id})

    if user_data is None:
        raise HTTPException(status_code=404, detail="User not found")

    if 'password' not in user_data or not user_data['password']:
        raise HTTPException(status_code=500, detail="User doesn't have permission")

    user_password = user_data['password'].encode('utf-8')

    if bcrypt.checkpw(password.encode('utf-8'), user_password):
        return { "status": "ok" }
    else:
        raise HTTPException(status_code=401, detail="Incorrect password")


# WS
@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_text()
            data_dict = json.loads(data)
            text_from_user = data_dict['text']
            user_id = int(data_dict['id'])
            user_data = await db.users.find_one({"user_id": user_id})

            # Формирование сообщения
            context_list = user_data.get("context", [])
            req_messages = []

            if len(context_list):
                for context in context_list:
                    req_messages.append({
                        "role": "system",
                        "content": context
                    })

            req_messages.append({
                "role": "user",
                "content": text_from_user
            })

            # Запрос
            stream = await client.chat.completions.create(
                model="gpt-4-0125-preview",
                messages=req_messages,
                stream=True
            )

            # Сообщение юзера в базу
            message_entry = {
                "role": "user",
                "content": text_from_user,
                "timestamp": datetime.now().isoformat()
            }
            await db.users.update_one({"user_id": user_id}, {"$push": {"history": message_entry}})

            # Контекст Юзера
            await db.users.update_one(
                {"user_id": user_id},
                {"$push": {
                    "context": {
                        "$each": ["user:" + text_from_user],
                        "$slice": -4
                    }
                }}
            )


            full_message_gpt = ''
            async for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    full_message_gpt += content
                    await websocket.send_text(content)
                if chunk.choices[0].finish_reason == 'stop': # Финальный кусок
                    # Ответ GTP в базу
                    response_entry = {
                        "role": "assistant",
                        "content": full_message_gpt,
                        "timestamp": datetime.now().isoformat()
                    }
                    await db.users.update_one({"user_id": user_id}, {"$push": {"history": response_entry}})

                    # Контекст GTP
                    await db.users.update_one({"user_id": user_id}, {"$push": {"context": "assistant:" + full_message_gpt}})

                    await websocket.send_text("END_OF_STREAM")
                    break

    except WebSocketDisconnect:
        print("Клиент отключился")
    except Exception as e:
        print(f"Произошла ошибка: {str(e)}")
        await websocket.send_text("Произошла внутренняя ошибка сервера")
    finally:
        if not websocket.application_state == "closed":
            await websocket.close()



# История сообщений
class UserHistoryRequest(BaseModel):
    user_id: int

@app.get("/api/history/{user_id}")
async def get_user_history(user_id: int):
    user_data = await db.users.find_one({"user_id": user_id})

    if not user_data:
        raise HTTPException(status_code=404, detail="User с таким ID не найден")

    return {
        "user_id": user_id,
        "history": user_data.get("history", []),
        "context": user_data.get("context", [])
    }

@app.get("/api/history/{user_id}/last")
async def get_last_user_message(user_id: int):
    user_data = await db.users.find_one({"user_id": user_id})

    if not user_data:
        raise HTTPException(status_code=404, detail="User с таким ID не найден")
    if not user_data.get("history"):
        return {
            "user_id": user_id,
            "last_message": None
        }

    last_message = user_data["history"][-1]

    return {
        "user_id": user_id,
        "last_message": last_message
    }

@app.post("/api/clear-history/{user_id}")
async def clear_user_history(user_id: int):
    user_data = await db.users.find_one({"user_id": user_id})
    if not user_data:
        raise HTTPException(status_code=404, detail="User с таким ID не найден")

    db.users.update_one({"user_id": user_id}, {"$set": {"history": []}})

    return {"message": f"История для user {user_id} была очищена"}



# ---- [ Тесты ] ----
@app.post("/api/test")
async def test_post():
    return {
        "message" : "Test is successful"
    }

