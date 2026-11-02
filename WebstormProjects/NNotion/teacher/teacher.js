function send() {
    const text = document.getElementById("msg").value;
    let arr = JSON.parse(localStorage.getItem("notifications") || "[]");

    arr.push({ text, date: new Date().toJSON() });

    localStorage.setItem("notifications", JSON.stringify(arr));
    alert("Уведомление отправлено!");
}