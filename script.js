const socket = io("http://localhost:3001");
let currentGroupId = 1;
let currentNick = "";  // ← guarda seu nick atual

function loadGroups() {
  fetch("http://localhost:3001/api/groups")
    .then(res => res.json())
    .then(groups => {
      const list = document.getElementById("groupList");
      list.innerHTML = "";
      groups.forEach(group => {
        const li = document.createElement("li");
        li.textContent = group.name;
        li.onclick = () => switchGroup(group.id, group.name, li);
        list.appendChild(li);
        if (group.id === 1) li.classList.add("active");
      });
    });
}

function switchGroup(id, name, element) {
  currentGroupId = id;
  document.getElementById("currentGroup").textContent = `# ${name}`;
  document.querySelectorAll("#groupList li").forEach(li => li.classList.remove("active"));
  element.classList.add("active");
  loadMessages();
}

function loadMessages() {
  fetch(`http://localhost:3001/api/messages/${currentGroupId}`)
    .then(res => res.json())
    .then(messages => {
      const box = document.getElementById("messages");
      box.innerHTML = "";
      messages.forEach(msg => {
        const el = document.createElement("div");
        el.classList.add("message");
        el.dataset.id = msg.id;
        // Cria o HTML base
        el.innerHTML = `<strong>${msg.nickname}:</strong> ${msg.content}`;
        // Se for sua mensagem, adiciona botão de deletar
        if (msg.nickname === currentNick) {
          const btn = document.createElement("button");
          btn.textContent = "🗑️";
          btn.classList.add("delete-btn");
          btn.onclick = () => deleteMessage(msg.id, el);
          el.appendChild(btn);
        }
        box.appendChild(el);
      });
      box.scrollTop = box.scrollHeight;
    });
}

function deleteMessage(id, element) {
  fetch(`http://localhost:3001/api/messages/${id}`, { method: "DELETE" })
    .then(res => res.json())
    .then(() => {
      element.remove();
    });
}

document.getElementById("send").onclick = () => {
  const nick = document.getElementById("nickname").value.trim() || "Anônimo";
  currentNick = nick;  // ← atualiza seu nick
  const msg = document.getElementById("message").value.trim();
  if (msg) {
    socket.emit("sendMessage", {
      groupId: currentGroupId,
      nickname: nick,
      content: msg
    });
    document.getElementById("message").value = "";
  }
};

socket.on("newMessage", (msg) => {
  if (msg.groupId === currentGroupId) {
    // reaproveita loadMessages para consistência
    loadMessages();
  }
});

// Quando outro cliente apagar, remove também aqui
socket.on("deleteMessage", ({ id }) => {
  const el = document.querySelector(`.chat-messages .message[data-id='${id}']`);
  if (el) el.remove();
});

document.getElementById("toggleTheme").onclick = () => {
  document.body.classList.toggle("dark");
};

document.getElementById("createGroup").onclick = () => {
  const name = prompt("Nome do grupo:");
  if (name) {
    fetch("http://localhost:3001/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, members: [] })
    }).then(loadGroups);
  }
};

window.onload = () => {
  loadGroups();
  loadMessages();
};
