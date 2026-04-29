const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// ─── STATE ────────────────────────────────────────────────────
let financeData = blankState();

// ─── BLANK STATE FACTORY ──────────────────────────────────────
function blankState() {
    return {
        weeks: Array.from({ length: 4 }, () => ({
            days: Array.from({ length: 5 }, () => ({ in: 0, out: 0, date: "" }))
        }))
    };
}

// ─── BOOT ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    loadFromStorage();
    initBoard();
    updateCalculations();
});

// ═══════════════════════════════════════════════════════════════
//  BOARD INITIALISATION
// ═══════════════════════════════════════════════════════════════
function initBoard() {
    const container = document.getElementById("weeks-container");
    const weekTpl   = document.getElementById("week-template").content;
    const dayTpl    = document.getElementById("day-template").content;

    container.innerHTML = "";

    financeData.weeks.forEach((week, wIndex) => {
        let weekNode = document.importNode(weekTpl, true);
        weekNode.querySelector(".week-num").textContent = wIndex + 1;

        const daysContainer = weekNode.querySelector(".days-container");

        week.days.forEach((day, dIndex) => {
            let dayNode = document.importNode(dayTpl, true);
            dayNode.querySelector(".day-name").textContent = dayNames[dIndex];

            const inInput   = dayNode.querySelector(".cash-in");
            const outInput  = dayNode.querySelector(".expense");
            const dateInput = dayNode.querySelector(".day-date");

            inInput.dataset.w   = wIndex;
            inInput.dataset.d   = dIndex;
            outInput.dataset.w  = wIndex;
            outInput.dataset.d  = dIndex;
            dateInput.dataset.w = wIndex;
            dateInput.dataset.d = dIndex;

            // Restore saved values
            if (day.in  > 0) inInput.value  = day.in;
            if (day.out > 0) outInput.value = day.out;
            if (day.date)    dateInput.value = day.date;

            inInput.addEventListener("input",  handleInput);
            outInput.addEventListener("input", handleInput);
            dateInput.addEventListener("change", handleDateInput);

            daysContainer.appendChild(dayNode);
        });

        weekNode.querySelector(".wk-in").id      = `w${wIndex}-in`;
        weekNode.querySelector(".wk-out").id     = `w${wIndex}-out`;
        weekNode.querySelector(".wk-balance").id = `w${wIndex}-bal`;

        container.appendChild(weekNode);
    });
}

// ═══════════════════════════════════════════════════════════════
//  INPUT HANDLER
// ═══════════════════════════════════════════════════════════════
function handleInput(e) {
    const input = e.target;
    const w = parseInt(input.dataset.w);
    const d = parseInt(input.dataset.d);

    let val = round2(parseFloat(input.value) || 0);
    if (val < 0) { val = 0; input.value = ""; }

    if (input.classList.contains("cash-in")) {
        financeData.weeks[w].days[d].in = val;
    } else {
        financeData.weeks[w].days[d].out = val;
    }

    updateCalculations();
    saveToStorage();
}

function handleDateInput(e) {
    const input = e.target;
    const w = parseInt(input.dataset.w);
    const d = parseInt(input.dataset.d);

    financeData.weeks[w].days[d].date = input.value;
    saveToStorage();
}

// ═══════════════════════════════════════════════════════════════
//  CALCULATIONS
// ═══════════════════════════════════════════════════════════════
const round2 = (n) => Math.round(n * 100) / 100;

const formatMoney = (amount) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(amount);

function updateCalculations() {
    const weeksDom = document.querySelectorAll(".week-card");
    if (weeksDom.length === 0) return;

    let monthlyIn = 0, monthlyOut = 0;

    financeData.weeks.forEach((week, wIndex) => {
        let wkIn = 0, wkOut = 0;
        const daysDom = weeksDom[wIndex].querySelectorAll(".day-row");

        week.days.forEach((day, dIndex) => {
            wkIn  = round2(wkIn  + day.in);
            wkOut = round2(wkOut + day.out);

            const dayDb       = round2(day.in - day.out);
            const displayNode = daysDom[dIndex].querySelector(".db-val");
            displayNode.textContent = formatMoney(dayDb);
            displayNode.classList.remove("positive", "negative");
            if (dayDb > 0) displayNode.classList.add("positive");
            if (dayDb < 0) displayNode.classList.add("negative");
        });

        document.getElementById(`w${wIndex}-in`).textContent  = formatMoney(wkIn);
        document.getElementById(`w${wIndex}-out`).textContent = formatMoney(wkOut);

        const wkBal     = round2(wkIn - wkOut);
        const wkBalNode = document.getElementById(`w${wIndex}-bal`);
        wkBalNode.textContent = formatMoney(wkBal);
        wkBalNode.style.color = wkBal >= 0 ? "var(--neon-green)" : "var(--neon-red)";

        monthlyIn  = round2(monthlyIn  + wkIn);
        monthlyOut = round2(monthlyOut + wkOut);
    });

    document.getElementById("monthly-in").textContent  = formatMoney(monthlyIn);
    document.getElementById("monthly-out").textContent = formatMoney(monthlyOut);

    const monthlyBal    = round2(monthlyIn - monthlyOut);
    const monthBalNode  = document.getElementById("monthly-balance");
    monthBalNode.textContent = formatMoney(monthlyBal);
    monthBalNode.style.color = monthlyBal >= 0 ? "var(--neon-blue)" : "var(--neon-red)";
}

// ═══════════════════════════════════════════════════════════════
//  NEW MONTH
// ═══════════════════════════════════════════════════════════════
function startNewMonth() {
    if (!confirm("End this month and start a new one? All current data will be cleared.")) return;
    financeData = blankState();
    localStorage.removeItem("financeTrackerState");
    initBoard();
    updateCalculations();
}

// ═══════════════════════════════════════════════════════════════
//  LOCAL STORAGE PERSISTENCE
// ═══════════════════════════════════════════════════════════════
function saveToStorage() {
    try {
        localStorage.setItem("financeTrackerState", JSON.stringify(financeData));
        setSaveStatus("saved", "Data saved locally ✓");
    } catch (e) {
        setSaveStatus("error", "⚠ Could not save — storage full?");
    }
}

function loadFromStorage() {
    try {
        const raw = localStorage.getItem("financeTrackerState");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.weeks) && parsed.weeks.length === 4) {
            financeData = parsed;
        }
    } catch (e) {
        console.error("Saved data corrupted, starting fresh.", e);
        localStorage.removeItem("financeTrackerState");
    }
}

function setSaveStatus(state, msg) {
    const el   = document.getElementById("save-status");
    const text = document.getElementById("save-status-text");
    if (!el || !text) return;
    el.className = "save-status " + state;
    text.textContent = msg;
}

// ═══════════════════════════════════════════════════════════════
//  EXPORT TO CSV
// ═══════════════════════════════════════════════════════════════
function exportToCSV() {
    const today = new Date().toISOString().split("T")[0];
    let rows = [["Week", "Day", "Date", "Cash In (KES)", "Expense (KES)", "Day Balance (KES)"]];

    let grandIn = 0, grandOut = 0;

    financeData.weeks.forEach((week, wIndex) => {
        let wkIn = 0, wkOut = 0;
        week.days.forEach((day, dIndex) => {
            const dayBal = round2(day.in - day.out);
            wkIn  = round2(wkIn  + day.in);
            wkOut = round2(wkOut + day.out);
            rows.push([
                `Week ${wIndex + 1}`,
                dayNames[dIndex],
                day.date || "",
                day.in.toFixed(2),
                day.out.toFixed(2),
                dayBal.toFixed(2)
            ]);
        });

        const wkBal = round2(wkIn - wkOut);
        rows.push([`Week ${wIndex + 1} TOTAL`, "", "", wkIn.toFixed(2), wkOut.toFixed(2), wkBal.toFixed(2)]);
        rows.push([]);

        grandIn  = round2(grandIn  + wkIn);
        grandOut = round2(grandOut + wkOut);
    });

    rows.push(["MONTHLY TOTAL", "", "", grandIn.toFixed(2), grandOut.toFixed(2), round2(grandIn - grandOut).toFixed(2)]);

    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), {
        href: url,
        download: `finance-tracker-${today}.csv`
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}