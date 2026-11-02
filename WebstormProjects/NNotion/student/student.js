window.onload = function() {
    let data = JSON.parse(localStorage.getItem("notifications") || "[]");
    let container = document.getElementById("notif");

    container.innerHTML = data.length === 0
        ? "Нет уведомлений"
        : data.map(n => `<p>${n.text} (${n.date})</p>`).join("");
}