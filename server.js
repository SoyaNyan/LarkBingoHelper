const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static("public"));

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/index.html");
});

io.on("connection", (socket) => {
	console.log(`${socket.id} connected to the server.`);

	socket.on("disconnect", () => {
		console.log(`${socket.id} disconnected from the server.`);
	});

	socket.on("bingoCreate", (data) => {
		const { uuid } = data;
		socket.join(uuid);
		console.log(`UUID:${uuid}(SocketId:${socket.id}) created new game.`);
		io.to(uuid).emit("joinRoom", {
			uuid: uuid,
			room: uuid,
			resp: "success",
		});
	});

	socket.on("joinRoom", (data) => {
		const { uuid, room } = data;
		socket.join(room);
		console.log(`UUID:${uuid}(SocketId:${socket.id}) joined ${room}.`);
		io.to(room).emit("joinRoom", {
			uuid: uuid,
			room: room,
			resp: "success",
		});
	});

	socket.on("leaveRoom", (data) => {
		const { uuid, room } = data;
		socket.leave(room);
		console.log(`UUID:${uuid}(SocketId:${socket.id}) leaved ${room}.`);
		io.to(room).emit("leaveRoom", {
			uuid: uuid,
			room: room,
			resp: "success",
		});
	});

	socket.on("endRoom", (data) => {
		const { room } = data;
		console.log(`UUID:${room}(SocketId:${socket.id}) closed ${room}.`);
		io.to(room).emit("endRoom", {
			room: room,
			resp: "success",
		});
	});

	socket.on("updateBoard", (data) => {
		const { room, cellState, totalPage, currentPage } = data;
		io.to(room).emit("updateBoard", {
			room,
			cellState,
			totalPage,
			currentPage,
		});
	});

	socket.on("bingoLog", (data) => {
		const { room, type, message } = data;
		io.to(room).emit("bingoLog", {
			type,
			message,
		});
	});
});

server.listen(3000, () => {
	console.log("Server is running on port 3000...");
});
