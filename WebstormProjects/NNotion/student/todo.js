function priority(deadline, difficulty) {
    const days = Math.max(1, (new Date(deadline) - new Date()) / 86400000);
    return (difficulty * 10) / days;
}

function addTask() {
    const t = task.value;
    const d = deadline.value;
    const diff = difficulty.value;

    let arr = JSON.parse(localStorage.getItem("tasks") || "[]");

    arr.push({
        title: t,
        deadline: d,
        difficulty: diff,
        pr: priority(d, diff)
    });

    localStorage.setItem("tasks", JSON.stringify(arr));
    render();
}

function render() {
    let arr = JSON.parse(localStorage.getItem("tasks") || "[]");
    arr.sort((a,b) => b.pr - a.pr);

    list.innerHTML = arr.map(a =>
        `<div><b>${a.title}</b> — приоритет: ${a.pr.toFixed(2)}</div>`
    ).join("");
}

render();