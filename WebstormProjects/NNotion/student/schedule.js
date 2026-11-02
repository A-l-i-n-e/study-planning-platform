function add() {
    let arr = JSON.parse(localStorage.getItem("schedule") || "[]");
    arr.push({ event: event.value, date: date.value });
    localStorage.setItem("schedule", JSON.stringify(arr));
    show();
}

function show() {
    let arr = JSON.parse(localStorage.getItem("schedule") || "[]");

    out.innerHTML = arr.map(e =>
        `<p>${e.date} — ${e.event}</p>`
    ).join("");
}

show();