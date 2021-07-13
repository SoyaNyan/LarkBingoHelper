let storedCellState = [],
	totalPage = 0,
	currentPage = 0,
	isHost = false,
	simpleBar;

const generateUUID = () => {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		let r = (Math.random() * 16) | 0,
			v = c == "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
};
const UUID = generateUUID();
const socket = io("/");

socket.on("connect", () => {
	console.log(`You're connecting with socketId '${socket.id}'`);

	if (socket.connected) {
		socket.emit("bingoCreate", {
			uuid: UUID,
		});
		isHost = true;
	} else {
		alert("서버에 접속할 수 없습니다!");
		$("#join-bingo").attr("disabled", true);
	}
});

socket.on("disconnect", () => {
	console.log(`You're leaving server...`);
});

socket.on("joinRoom", (data) => {
	if (data.resp === "success") {
		console.log(`Joined to ${data.room}`);

		socket.emit("updateBoard", {
			room: UUID,
			cellState: storedCellState,
			totalPage,
			currentPage,
		});
	}
});

socket.on("updateBoard", (data) => {
	const { room } = data;
	if (room !== UUID) {
		resetCellState();

		totalPage = data.totalPage;
		currentPage = data.currentPage;
		storedCellState = data.cellState;

		updatePageCount();
		if (totalPage > 0) {
			restoreCellState(currentPage);
		}
	}
});

socket.on("leaveRoom", (data) => {
	if (data.resp === "success") {
		console.log(`Leaved from ${data.room}`);
	}
});

socket.on("endRoom", (data) => {
	const { room } = data;
	let targetUUID;

	if (room !== UUID) {
		targetUUID = $("#target-uuid").val();
	} else {
		targetUUID = room;
	}

	socket.emit("leaveRoom", {
		uuid: UUID,
		room: targetUUID,
	});

	isHost = true;
	socket.emit("bingoCreate", {
		uuid: UUID,
	});
	enableHostMode();
	$("#target-uuid").attr("readonly", false);

	resetCellState();
	storedCellState = [];
	totalPage = 0;
	currentPage = 0;
	updatePageCount();

	clearBingoLog();
});

socket.on("bingoLog", (data) => {
	pushBingoLog(data);
});

const boardMap = [
	["a1", "b1", "c1", "d1", "e1"],
	["a2", "b2", "c2", "d2", "e2"],
	["a3", "b3", "c3", "d3", "e3"],
	["a4", "b4", "c4", "d4", "e4"],
	["a5", "b5", "c5", "d5", "e5"],
];

$(document).ready(function () {
	$("#leave-bingo").hide();
	$("#end-bingo").hide();
	$("#target-uuid").attr("readonly", false);

	enableHostMode();

	$("#session-uuid").val(UUID);

	simpleBar = new SimpleBar(document.getElementById("log-box"), {
		autohide: true,
	});
});

$("#copy-uuid").on("click", function () {
	const tt = document.createElement("textarea");
	document.body.appendChild(tt);
	tt.value = UUID;
	tt.select();
	document.execCommand("copy");
	document.body.removeChild(tt);
});

$("#link-uuid").on("click", function () {
	alert("준비중인 기능이에요!");
});

$("#join-bingo").on("click", function () {
	const targetUUID = $("#target-uuid").val();
	if (typeof targetUUID == "undefined" || targetUUID === null || targetUUID == "") {
		alert("참여하려는 빙고방 코드를 입력하세요!");
	} else {
		if (UUID === targetUUID) {
			alert("본인이 생성한 게임에는 참가할 수 없습니다.");
		} else {
			if (socket.connected) {
				socket.emit("joinRoom", {
					uuid: UUID,
					room: targetUUID,
				});

				isHost = false;
				disableHostMode();

				clearBingoLog();
			} else {
				alert("서버에 접속할 수 없습니다!");
				$("#join-bingo").attr("disabled", true);
			}
		}
	}
});

$("#leave-bingo").on("click", function () {
	const targetUUID = $("#target-uuid").val();
	if (socket.connected) {
		socket.emit("leaveRoom", {
			uuid: UUID,
			room: targetUUID,
		});

		resetCellState();
		storedCellState = [];
		totalPage = 0;
		currentPage = 0;
		updatePageCount();

		isHost = true;
		enableHostMode();

		clearBingoLog();
	} else {
		alert("서버에 접속할 수 없습니다!");
		$("#leave-bingo").attr("disabled", true);
	}
});

$("#end-bingo").on("click", function () {
	if (isHost) {
		socket.emit("endRoom", {
			room: UUID,
		});
	}

	clearBingoLog();
});

$(".cell").on("click", function (e) {
	if (isHost) {
		$("#join-bingo").hide();
		$("#target-uuid").attr("readonly", true);
		$("#end-bingo").show();

		if (e.ctrlKey) {
			$(this).toggleClass("active");
		} else {
			const cellId = $(this).attr("id");
			const trimmedId = cellId.split("-")[1];

			socket.emit("bingoLog", {
				room: UUID,
				type: "bomb",
				message: `'${trimmedId.toUpperCase()}' 에 폭탄을 놓았습니다.`,
			});

			if (currentPage == 0) {
				saveCellState();
			}

			flipCell(trimmedId);
			saveCellState();

			socket.emit("updateBoard", {
				room: UUID,
				cellState: storedCellState,
				totalPage,
				currentPage,
			});
		}
	} else {
		return false;
	}
});

$("#prev").on("click", function () {
	resetCellState();
	if (currentPage - 1 > 0) {
		restoreCellState(--currentPage);
	}
});

$("#next").on("click", function () {
	resetCellState();
	if (currentPage - 1 < totalPage) {
		restoreCellState(++currentPage);
	}
});

$("#reset").on("click", function () {
	resetCellState();

	storedCellState = [];
	totalPage = 0;
	currentPage = 0;
	updatePageCount();

	socket.emit("updateBoard", {
		room: UUID,
		cellState: storedCellState,
		totalPage,
		currentPage,
	});
});

const flipCell = (cellId) => {
	let targetX, targetY;
	let targetArr;

	for (let i = 0; i < 5; i++) {
		for (let j = 0; j < 5; j++) {
			if (boardMap[i][j] == cellId) {
				targetX = i;
				targetY = j;
			}
		}
	}

	targetArr = checkTarget(targetX, targetY);
	targetArr.forEach((t) => {
		$(`#cell-${t}`).toggleClass("active");
	});

	checkAllBingo();
};

const checkTarget = (x, y) => {
	let tmpArr = [];
	tmpArr.push(boardMap[x][y]);

	if (x + 1 >= 0 && x + 1 <= 4 && y >= 0 && y <= 4) {
		tmpArr.push(boardMap[x + 1][y]);
	}
	if (x >= 0 && x <= 4 && y + 1 >= 0 && y + 1 <= 4) {
		tmpArr.push(boardMap[x][y + 1]);
	}
	if (x - 1 >= 0 && x - 1 <= 4 && y >= 0 && y <= 4) {
		tmpArr.push(boardMap[x - 1][y]);
	}
	if (x >= 0 && x <= 4 && y - 1 >= 0 && y - 1 <= 4) {
		tmpArr.push(boardMap[x][y - 1]);
	}

	return tmpArr;
};

const checkAllBingo = () => {
	let bingoCells = [];

	for (let i = 0; i < 5; i++) {
		for (let j = 0; j < 5; j++) {
			bingoCells = bingoCells.concat(checkStraightBingo(i, j));
		}
	}

	bingoCells = bingoCells.concat(checkDiagonalBingo());

	flipBingo(bingoCells);
};

const checkStraightBingo = (x, y) => {
	const cellState = checkCellState();
	let rowBingo = true,
		colBingo = true;
	let bingoCells = [];

	for (let i = 0; i < 5; i++) {
		if (cellState[x][i] == 0) {
			rowBingo = false;
		}
	}

	if (rowBingo) {
		for (let i = 0; i < 5; i++) {
			bingoCells.push(boardMap[x][i]);
		}
	}

	for (let i = 0; i < 5; i++) {
		if (cellState[i][y] == 0) {
			colBingo = false;
		}
	}

	if (colBingo) {
		for (let i = 0; i < 5; i++) {
			bingoCells.push(boardMap[i][y]);
		}
	}

	return bingoCells;
};

const checkDiagonalBingo = () => {
	const cellState = checkCellState();
	let diag1Bingo = true,
		diag2Bingo = true;
	let bingoCells = [];

	for (let i = 0; i < 5; i++) {
		if (cellState[i][i] == 0) {
			diag1Bingo = false;
		}
	}

	if (diag1Bingo) {
		for (let i = 0; i < 5; i++) {
			bingoCells.push(boardMap[i][i]);
		}
	}

	for (let i = 0; i < 5; i++) {
		if (cellState[i][Math.abs(4 - i)] == 0) {
			diag2Bingo = false;
		}
	}

	if (diag2Bingo) {
		for (let i = 0; i < 5; i++) {
			bingoCells.push(boardMap[i][Math.abs(4 - i)]);
		}
	}

	return bingoCells;
};

const flipBingo = (cells) => {
	let isNewBingo = false;
	cells.forEach((c) => {
		let cellId = `#cell-${c}`;

		if ($(cellId).hasClass("active")) {
			$(cellId).toggleClass("active");
		}

		if (!$(cellId).hasClass("bingo")) {
			$(cellId).toggleClass("bingo");
			isNewBingo = true;
		}
	});

	if (isHost && isNewBingo) {
		socket.emit("bingoLog", {
			room: UUID,
			type: "bingo",
			message: "빙고가 완성되었습니다.",
		});
	}
};

const checkCellState = () => {
	let cellStateArr = [
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
	];

	for (let i = 0; i < 5; i++) {
		for (let j = 0; j < 5; j++) {
			let cellId = `#cell-${boardMap[i][j]}`;
			if ($(cellId).hasClass("active") || $(cellId).hasClass("bingo")) {
				cellStateArr[i][j] = 1;
			}
		}
	}

	return cellStateArr;
};

const resetCellState = () => {
	$(".cell").each(function (index, item) {
		if ($(item).hasClass("active")) {
			$(item).toggleClass("active");
		}

		if ($(item).hasClass("bingo")) {
			$(item).toggleClass("bingo");
		}
	});
};

const saveCellState = () => {
	let cellStateArr = [
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
	];

	for (let i = 0; i < 5; i++) {
		for (let j = 0; j < 5; j++) {
			let cellId = `#cell-${boardMap[i][j]}`;

			if ($(cellId).hasClass("active")) {
				cellStateArr[i][j] = 1;
			}

			if ($(cellId).hasClass("bingo")) {
				cellStateArr[i][j] = 2;
			}
		}
	}

	storedCellState.push(cellStateArr);

	currentPage++;
	totalPage++;
	updatePageCount();
};

const restoreCellState = (page) => {
	const cellStateArr = storedCellState[page - 1];

	for (let i = 0; i < 5; i++) {
		for (let j = 0; j < 5; j++) {
			let cellId = `#cell-${boardMap[i][j]}`;

			if (cellStateArr[i][j] == 1) {
				$(cellId).toggleClass("active");
			}

			if (cellStateArr[i][j] == 2) {
				$(cellId).toggleClass("bingo");
			}
		}
	}

	updatePageCount();
};

const updatePageCount = () => {
	$("#page-count").text(`${currentPage} / ${totalPage}`);

	if (totalPage > 1) {
		if (currentPage > 1) {
			$("#prev").attr("disabled", false);
		} else {
			$("#prev").attr("disabled", true);
		}

		if (currentPage < totalPage) {
			$("#next").attr("disabled", false);
		} else {
			$("#next").attr("disabled", true);
		}
	} else {
		$("#prev").attr("disabled", true);
		$("#next").attr("disabled", true);
	}
};

const enableHostMode = () => {
	$("#join-bingo").show();
	$("#leave-bingo").hide();
	$("#end-bingo").hide();
	$("#target-uuid").val("");
	$("#reset").attr("disabled", false);
};

const disableHostMode = () => {
	$("#join-bingo").hide();
	$("#leave-bingo").show();
	$("#end-bingo").hide();
	$("#target-uuid").attr("readonly", true);
	$("#reset").attr("disabled", true);
};

const pushBingoLog = (data) => {
	const { type, message } = data;
	let toastBg;

	switch (type) {
		case "bomb":
			toastBg = "bg-secondary";
			break;
		case "bingo":
			toastBg = "bg-bingo";
			break;
		default:
	}

	let logToast = `
		<div class="toast align-items-center text-white ${toastBg} border-0 fade show mb-2" role="alert" aria-live="assertive" aria-atomic="true">
			<div class="d-flex">
				<div class="toast-body">
					${type == "bomb" ? '<i class="fas fa-bomb"></i>' : '<i class="fas fa-crosshairs"></i>'} ${message}
				</div>
			</div>
		</div>
	`;

	simpleBar.getContentElement().insertAdjacentHTML("afterbegin", logToast);
};

const clearBingoLog = () => {
	$(".toast").remove();
};
