document.addEventListener('DOMContentLoaded', () => {
    const txtFld = document.getElementById('textField');
    const usrID1 = document.getElementById('userID1');
    const usrID2 = document.getElementById('userID2');
    const cht = document.getElementById('chat');

    const hostName = document.location.hostname;
    let wsURL = "";
    if( hostName === 'localhost' || hostName === '127.0.0.1' ){
        wsURL = "ws://127.0.0.1:8000/api/ws";
    }else{
        wsURL = "wss://" + hostName + "/api/ws";
    }


    // ---- [ Основное ] ----
    // Отправка сообщения
    function sendMess(){
        const mess = txtFld.value;
        const idV = Number(usrID2.value);

        let usrMsg = document.createElement('div');
        usrMsg.textContent = txtFld.value;
        usrMsg.classList.add('mess__user')
        cht.appendChild( usrMsg );
        txtFld.value = '';
        cht.scrollTop = cht.scrollHeight;

        fetch('/api/send-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: mess,
                id : idV
            }),
        })
            .then(response => response.json())
            .then(data => {
                let aiMsg = document.createElement('div');
                aiMsg.textContent = data.message.content;
                aiMsg.classList.add('mess__ai')
                cht.appendChild( aiMsg );
                cht.scrollTop = cht.scrollHeight;
            })
            .catch(error => {
                console.error('Произошла ошибка при выполнении запроса:', error);
            });
    }
    document.getElementById('sendMess').addEventListener('click', function () {
        sendMess();
    });

    // Получение истории сообщений
    document.getElementById('getHistory').addEventListener('click', function () {
        fetch('/api/history/' + Number(usrID1.value), {
                method : 'GET',
                headers : {
                    'Content-Type' : 'application/json'
                }
            })
            .then(async response => {
                if( response.ok ){
                    const data = await response.json();
                    cht.innerHTML = '';

                    if( data.history.length ){
                        data.history.forEach( item => {
                            let msg = document.createElement('div');
                            let ttl = document.createElement('div');
                            ttl.textContent = item.role + ' (' + item.timestamp + ')';
                            msg.textContent = item.content;

                            if( item.role === 'user' ){
                                msg.classList.add('mess__user')
                            }else if( item.role === 'assistant' ){
                                msg.classList.add('mess__ai')
                            }
                            ttl.classList.add('mess_title');
                            msg.prepend( ttl );

                            cht.appendChild( msg );
                        });
                    }else{
                        let msg = document.createElement('div');
                        msg.textContent = 'User есть, но history пуста';
                        msg.classList.add('mess_sys');
                        cht.appendChild( msg );
                    }
                    cht.scrollTop = cht.scrollHeight;
                }else {
                    const errorData = await response.json();

                    let msg = document.createElement('div');
                    msg.textContent = errorData.detail || 'Произошла ошибка';
                    msg.classList.add('mess_sys')
                    cht.innerHTML = '';
                    cht.appendChild( msg );
                }
            }).catch( error => {
                console.error('Произошла ошибка при выполнении запроса:', error);
            });
    });
    // Последнее сообщение из истории
    document.getElementById('getHistoryLast').addEventListener('click', function () {
        fetch('/api/history/' + Number(usrID1.value) + '/last', {
            method : 'GET',
            headers : {
                'Content-Type' : 'application/json'
            }
        })
            .then(async response => {
                if( response.ok ){
                    const data = await response.json();
                    cht.innerHTML = '';

                    let item = data.last_message;

                    if( item ){
                        let msg = document.createElement('div');
                        let ttl = document.createElement('div');
                        ttl.textContent = item.role + ' (' + item.timestamp + ')';
                        msg.textContent = item.content;

                        if( item.role === 'user' ){
                            msg.classList.add('mess__user')
                        }else if( item.role === 'assistant' ){
                            msg.classList.add('mess__ai')
                        }
                        ttl.classList.add('mess_title');
                        msg.prepend( ttl );

                        cht.appendChild( msg );
                    }else{
                        let msg = document.createElement('div');
                        msg.textContent = 'User есть, но history пуста';
                        msg.classList.add('mess_sys');
                        cht.appendChild( msg );
                    }
                }else {
                    const errorData = await response.json();

                    let msg = document.createElement('div');
                    msg.textContent = errorData.detail || 'Произошла ошибка';
                    msg.classList.add('mess_sys')
                    cht.innerHTML = '';
                    cht.appendChild( msg );
                }
                cht.scrollTop = cht.scrollHeight;
            }).catch(error => {
            console.error('Произошла ошибка при выполнении запроса:', error);
        });

    });

    // Очистка истории сообщений
    document.getElementById('clearHistory').addEventListener('click', function () {
        cht.innerHTML = '';

        fetch('/api/clear-history/' + Number(usrID1.value), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(async response => {
                let msg = document.createElement('div');

                if( response.ok ){
                    const data = await response.json();
                    msg.textContent = data.message;
                }else {
                    const errorData = await response.json();
                    msg.textContent = errorData.detail || 'Произошла ошибка';
                }
                msg.classList.add('mess_sys')
                cht.appendChild( msg );
            }).catch(error => {
            console.error('Произошла ошибка при выполнении запроса:', error);
        });
    });


    // ---- [ Фунционал не связанный с Api ] ----
    document.getElementById('textField').addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMess();
        }
    });

    const mdHistory = document.getElementById('modal-history');
    function getHistory( id ){
        mdHistory.innerHTML = '';
        return fetch('/api/history/' + Number( id ), {
            method : 'GET',
            headers : {
                'Content-Type' : 'application/json'
            }
        })
            .then(async response => {
                if( response.ok ){
                    const data = await response.json();

                    if( data.history.length ){
                        data.history.forEach( item => {
                            let msg = document.createElement('div');
                            let ttl = document.createElement('div');
                            ttl.textContent = item.role === 'user' ? 'Вы' : 'GPT-4';
                            msg.textContent = item.content;
                            msg.classList.add('modal-chat_message');

                            ttl.classList.add('modal-chat_message-title');
                            msg.prepend( ttl );

                            mdHistory.appendChild( msg );
                        });
                        document.getElementById('modal-history').scrollTop = document.getElementById('modal-history').scrollHeight;
                    }
                }else {
                    const errorData = await response.json();
                    console.log( errorData.detail || 'Произошла ошибка' );
                }
            }).catch( error => {
            console.error('Произошла ошибка при выполнении запроса:', error);
        });
    }

    // Login
    const mdLogin = document.getElementById('modal-login');
    const mdChat = document.getElementById('modal-chat');

    function userAuth(){
        const userID = document.getElementById('user_id').value;
        const userPass = document.getElementById('password').value;

        fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: userID,
                password : userPass
            }),
        })
        .then(response => response.json())
        .then(data => {
            if( data.detail ){
                alert( data.detail )
            }else{
                document.cookie = "wsID=" + userID + "; path=/; max-age=604800";

                mdLogin.style.opacity = 0;
                async function hndlTransitionMdLogin() {
                    mdLogin.style.display = 'none';
                    mdLogin.removeEventListener('transitionend', hndlTransitionMdLogin);
                    mdChat.style.display = 'flex';
                    setTimeout(() => {
                        mdChat.style.opacity = 1;
                    }, 10);
                    await getHistory( userID );
                    const wsController = new WebSocketController(wsURL, wsID);
                }
                mdLogin.addEventListener('transitionend', hndlTransitionMdLogin);
            }
        })
        .catch(error => {
            console.error('Произошла ошибка при выполнении запроса:', error);
        });
    }
    document.getElementById('authBtn').addEventListener('click', function () {
        userAuth();
    });

    // Modal
    var overlay = document.getElementById('overlay');
    document.getElementById('modal-show').addEventListener('click', function (){
        const wsID = getCookie('wsID');

        if( wsID ){
            mdLogin.style.opacity = 0;
            mdLogin.style.display = 'none';

            mdChat.style.display = 'flex';
            setTimeout(async ()=>{
                mdChat.style.opacity = 1;
                await getHistory( wsID );
                const wsController = new WebSocketController(wsURL, wsID);
            }, 10);

        }else{
            mdLogin.style.opacity = 1;
            mdLogin.style.display = 'block';
        }

        overlay.style.display = 'block';
        setTimeout(function() {
            overlay.style.opacity = 1;
        }, 10);

    });
    document.getElementById('modal-close').addEventListener('click', function (){
        overlay.style.opacity = 0;

        function hndlTransitionOverlay() {
            overlay.style.display = 'none';
            overlay.removeEventListener('transitionend', hndlTransitionOverlay);

            mdLogin.style.opacity = 0;
            mdLogin.style.display = 'none';
            mdChat.style.opacity = 0;
            mdChat.style.display = 'none';
        }
        overlay.addEventListener('transitionend', hndlTransitionOverlay);
    });

    // Cookie
    function getCookie(name) {
        let nameEQ = name + "=";
        let ca = document.cookie.split(';');

        for(let i= 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) === 0) {
                return c.substring(nameEQ.length, c.length);
            }
        }
        return null;
    }
});

class WebSocketController {
    constructor(url, id) {
        this.socket = new WebSocket(url);
        this.userId = id;
        this.mdHistory = document.getElementById('modal-history');
        this.mdSend = document.getElementById('modalSendMess');
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.socket.onopen = () => {
            console.log("[open] Соединение установлено");
            document.getElementById('modalSendMess').addEventListener('click', this.sendMessage.bind(this));
        };

        this.socket.onmessage = (event) => {
            if( event.data === 'END_OF_STREAM' ){
                document.getElementsByClassName('modal-chat_message__last')[0].classList.remove('modal-chat_message__last');
                this.mdSend.disabled = false;
                this.mdHistory.scrollTop = this.mdHistory.scrollHeight;
            }else{
                document.getElementsByClassName('modal-chat_message__last')[0].getElementsByClassName('modal-chat_message-text')[0].innerText += event.data;
                this.mdHistory.scrollTop = this.mdHistory.scrollHeight;
            }
        };

        this.socket.onclose = (event) => {
            if (event.wasClean) {
                console.log(`[close] Соединение закрыто чисто, код=${event.code} причина=${event.reason}`);
            } else {
                console.log('[close] Соединение прервано');
            }
        };

        this.socket.onerror = (error) => {
            console.log(`[error] ${error.message}`);
        };
    }

    sendMessage() {
        const textField = document.getElementById('modalTextfield');
        const textMess = textField.value;
        if ( textMess.trim().length < 1 ) {
            alert('Поле сообщение не заполнено');
        } else {
            this.mdHistory.scrollTop = this.mdHistory.scrollHeight;
            this.mdSend.disabled = true;
            this.mdSend.setAttribute('disabled', true);
            let msg = document.createElement('div');
            msg.textContent = textMess;
            msg.classList.add('modal-chat_message');

            let ttl = document.createElement('div');
            ttl.textContent = 'Вы';
            ttl.classList.add('modal-chat_message-title');
            msg.prepend( ttl );
            this.mdHistory.appendChild( msg );
            textField.value = '';

            msg = document.createElement('div');
            msg.classList.add('modal-chat_message');
            msg.classList.add('modal-chat_message__last');
            ttl = document.createElement('div');
            ttl.textContent = 'GPT-4';
            ttl.classList.add('modal-chat_message-title');
            msg.prepend( ttl );
            let msgText = document.createElement('div');
            msgText.classList.add('modal-chat_message-text');
            msg.append( msgText );
            this.mdHistory.appendChild( msg );

            this.socket.send( JSON.stringify({ text : textMess, id : this.userId }) );
        }
    }
}