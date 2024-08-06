const bcrypt = require('bcrypt');

const password = 'MyName1sGreeDDD';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) {
        console.error(err);
        return;
    }
    console.log("Хеш пароля:", hash);
});