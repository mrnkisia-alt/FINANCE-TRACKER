const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// ─── STATE ────────────────────────────────────────────────────
let financeData = blankState();

// ─── BLANK STATE FACTORY ──────────────────────────────────────
function blankState() {
    return {
        weeks: Array.from({ length: 4 }, () => ({
            days: Array.from({ length: 5 }, () => ({ in: [], out: [], date: "" }))
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

            const dateInput = dayNode.querySelector(".day-date");
            const inInput   = dayNode.querySelector(".cash-in");
            const outInput  = dayNode.querySelector(".expense");

            dateInput.dataset.w = wIndex;
            dateInput.dataset.d = dIndex;
            inInput.dataset.w   = wIndex;
            inInput.dataset.d   = dIndex;
            outInput.dataset.w  = wIndex;
            outInput.dataset.d  = dIndex;

            if (day.date) dateInput.value = day.date;

            dateInput.addEventListener("change", handleDateInput);
            inInput.addEventListener("keydown", handleKeyAdd);
            outInput.addEventListener("keydown", handleKeyAdd);

            // Render existing chips
            renderChips(dayNode.querySelector(".income-entries"),  day.in,  wIndex, dIndex, 'in');
            renderChips(dayNode.querySelector(".expense-entries"), day.out, wIndex, dIndex, 'out');

            daysContainer.appendChild(dayNode);
        });

        weekNode.querySelector(".wk-in").id      = `w${wIndex}-in`;
        weekNode.querySelector(".wk-out").id     = `w${wIndex}-out`;
        weekNode.querySelector(".wk-balance").id = `w${wIndex}-bal`;

        container.appendChild(weekNode);
    });
}

function renderChips(container, values, w, d, type) {
    container.innerHTML = "";
    let sum = 0;
    values.forEach((val, idx) => {
        sum += val;
        const chip = document.createElement("div");
        chip.className = "entry-chip";
        chip.innerHTML = `${val.toLocaleString()} <span style="opacity:0.5; margin-left:4px;">×</span>`;
        chip.onclick = (e) => {
            e.stopPropagation(); // prevent closing drawer
            removeEntry(w, d, type, idx);
        };
        container.appendChild(chip);
    });

    // Update the total display next to the drawer
    const wrapper = container.closest(".entries-wrapper");
    const totalDisplay = wrapper.querySelector(".total-display");
    totalDisplay.textContent = formatMoney(sum);
}

function toggleDetails(el) {
    const drawer = el.nextElementSibling;
    const isExpanded = drawer.classList.contains("expanded");
    
    // Close all other drawers in the same day or week for focus? 
    // Or just toggle this one.
    drawer.classList.toggle("expanded");
}

// ═══════════════════════════════════════════════════════════════
//  INPUT HANDLER
// ═══════════════════════════════════════════════════════════════
function handleKeyAdd(e) {
    if (e.key !== "Enter") return;
    const input = e.target;
    const w = parseInt(input.dataset.w);
    const d = parseInt(input.dataset.d);
    const type = input.classList.contains("cash-in") ? "in" : "out";

    let val = round2(parseFloat(input.value) || 0);
    if (val <= 0) return;

    financeData.weeks[w].days[d][type].push(val);
    input.value = "";

    // Refresh UI for this day
    const dayRow = input.closest(".day-row");
    const container = dayRow.querySelector(`.${type === 'in' ? 'income' : 'expense'}-entries`);
    renderChips(container, financeData.weeks[w].days[d][type], w, d, type);

    updateCalculations();
    saveToStorage();
}

function removeEntry(w, d, type, idx) {
    financeData.weeks[w].days[d][type].splice(idx, 1);
    
    // Refresh the whole board (simplest way to ensure all containers stay in sync)
    // For better performance, we could target just the specific container
    initBoard(); 
    updateCalculations();
    saveToStorage();
}

function handleDateInput(e) {
    const input = e.target;
    const w = parseInt(input.dataset.w);
    const d = parseInt(input.dataset.d);

    financeData.weeks[w].days[d].date = input.value;
    
    // Sync full month if Week 1 Monday is set
    if (w === 0 && d === 0 && input.value) {
        syncAllDates(input.value);
    } else {
        saveToStorage();
    }
}

function syncAllDates(baseDateStr) {
    const baseDate = new Date(baseDateStr);
    if (isNaN(baseDate.getTime())) return;

    financeData.weeks.forEach((week, wIdx) => {
        week.days.forEach((day, dIdx) => {
            // Monday of each week is +7 days from previous Monday
            // Day D of each week is Monday + D days
            const date = new Date(baseDate);
            date.setDate(baseDate.getDate() + (wIdx * 7) + dIdx);
            
            day.date = date.toISOString().split('T')[0];
        });
    });

    initBoard();
    updateCalculations();
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
            const sumIn  = day.in.reduce((a, b) => a + b, 0);
            const sumOut = day.out.reduce((a, b) => a + b, 0);

            wkIn  = round2(wkIn  + sumIn);
            wkOut = round2(wkOut + sumOut);

            const dayDb       = round2(sumIn - sumOut);
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
            // Migration: Ensure in/out are arrays
            parsed.weeks.forEach(week => {
                week.days.forEach(day => {
                    if (typeof day.in  === 'number') day.in  = day.in > 0 ? [day.in] : [];
                    if (typeof day.out === 'number') day.out = day.out > 0 ? [day.out] : [];
                });
            });
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
            const sumIn  = day.in.reduce((a, b) => a + b, 0);
            const sumOut = day.out.reduce((a, b) => a + b, 0);
            const dayBal = round2(sumIn - sumOut);

            wkIn  = round2(wkIn  + sumIn);
            wkOut = round2(wkOut + sumOut);

            rows.push([
                `Week ${wIndex + 1}`,
                dayNames[dIndex],
                day.date || "",
                sumIn.toFixed(2),
                sumOut.toFixed(2),
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