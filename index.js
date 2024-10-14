var express = require('express');
var socket = require('socket.io');
var mongoose = require('mongoose');
var app = express();

// Conectar a MongoDB
mongoose.connect('mongodb://localhost/chatDB', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Conectado a la base de datos MongoDB'))
    .catch(err => console.log('Error de conexión a MongoDB:', err));

// Esquema del usuario
var UsuarioSchema = new mongoose.Schema({
    usuario: { type: String, unique: true },
    contraseña: String
});

var Usuario = mongoose.model('Usuario', UsuarioSchema);

// Esquema del mensaje
var MensajeSchema = new mongoose.Schema({
    usuario: String,
    mensaje: String,
    fecha: { type: Date, default: Date.now }
});

var Mensaje = mongoose.model('Mensaje', MensajeSchema);

var server = app.listen(5000, function() {
    console.log("Servidor escuchando en puerto 5000...");
});

app.use(express.static('public'));

var io = socket(server);
var usuariosEnLinea = [];

// Conexión de socket
io.on('connection', function(socket) {
    console.log('Nueva conexión: ' + socket.id);

    // Cargar los mensajes existentes desde MongoDB
    Mensaje.find().sort('fecha').then(mensajes => {
        socket.emit('cargarMensajes', mensajes); // Enviar los mensajes al cliente
    }).catch(err => {
        console.log('Error al cargar los mensajes:', err);
    });

    // Al recibir un nuevo mensaje
    socket.on('chat', function(data) {
        var nuevoMensaje = new Mensaje({
            usuario: data.usuario,
            mensaje: data.mensaje
        });

        nuevoMensaje.save().then(() => {
            io.sockets.emit('chat', data); // Emitir el mensaje a todos
        }).catch(err => {
            console.log('Error al guardar el mensaje:', err); // Manejar errores al guardar
        });
    });

    // Al recibir un nuevo usuario para registrar
    socket.on('registrarUsuario', function(data) {
        var nuevoUsuario = new Usuario({
            usuario: data.usuario,
            contraseña: data.contraseña
        });

        nuevoUsuario.save().then(() => {
            socket.emit('respuestaValidacion', { validado: true, usuario: data.usuario });
        }).catch(err => {
            console.log('Error al registrar el usuario:', err);
            socket.emit('respuestaValidacion', { validado: false });
        });
    });

    // Validar usuario al iniciar sesión
    socket.on('validarUsuario', function(data) {
        Usuario.findOne({ usuario: data.usuario, contraseña: data.contraseña })
            .then(usuario => {
                if (usuario) {
                    socket.emit('respuestaValidacion', { validado: true, usuario: usuario.usuario });
                } else {
                    socket.emit('respuestaValidacion', { validado: false });
                }
            })
            .catch(err => {
                console.log('Error al validar usuario:', err);
                socket.emit('respuestaValidacion', { validado: false });
            });
    });

    // Al recibir un usuario nuevo
    socket.on('nuevoUsuario', function(nombreUsuario) {
        if (!usuariosEnLinea.includes(nombreUsuario)) {
            usuariosEnLinea.push(nombreUsuario);
            io.sockets.emit('usuariosEnLinea', usuariosEnLinea); // Emitir lista de usuarios en línea
        }
    });

    // Al desconectarse
    socket.on('disconnect', function() {
        usuariosEnLinea = usuariosEnLinea.filter(usuario => usuario !== socket.username);
        io.sockets.emit('usuariosEnLinea', usuariosEnLinea); // Actualizar lista de usuarios en línea
    });

    // Mostrar que el usuario está escribiendo
    socket.on('typing', function(data) {
        socket.broadcast.emit('typing', data);
    });
});
