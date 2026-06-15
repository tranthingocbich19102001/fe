const terms = [6, 9, 12, 15, 18, 21, 24];
const interestLookup = [
    { x: 0.49, y: 10.6 },
    { x: 0.69, y: 15.5 },
    { x: 0.55, y: 12 },
    { x: 0.79, y: 17 },
    { x: 0.89, y: 19 },
    { x: 0.99, y: 21.5 },
    { x: 1.19, y: 25.5 },
    { x: 1.29, y: 27.5 },
    { x: 1.39, y: 29.5 },
    { x: 1.41, y: 30.5 },
    { x: 1.49, y: 32 },
    { x: 1.69, y: 36 }
];

// current available terms (may be restricted by selected interest)
let currentTerms = [...terms];

// special rules for certain interest options
const specialInterestRules = {
    0.55: { minDownpaymentPercent: 10, termRange: [15, 24] },
    0.69: { minDownpaymentPercent: 20, termRange: [6, 12] },
    0.79: { minDownpaymentPercent: 10, termRange: [6, 12] },
};

function applyInterestRules(x) {
    const key = Number(x);
    const rule = specialInterestRules[key];
    // reset to defaults
    currentTerms = [...terms];
    if (rule) {
        const [minT, maxT] = rule.termRange;
        currentTerms = terms.filter((t) => t >= minT && t <= maxT);
        // do NOT auto-change user inputs here; validation happens in calculate()
    }
}

function getInterestRule(x) {
    return specialInterestRules[Number(x)] || null;
}

const vehiclePriceInput = document.getElementById('vehicle-price');
const downpaymentInput = document.getElementById('downpayment');
const downpaymentPercentInput = document.getElementById('downpayment-percent');
const interestInput = document.getElementById('interest-input');
const annualRateInput = document.getElementById('annual-rate');
const termGrid = document.getElementById('term-grid');
const loanAmountEl = document.getElementById('loan-amount');
const insuranceAmountEl = document.getElementById('insurance-amount');
const totalDebtEl = document.getElementById('total-debt');
const resultStatus = document.getElementById('result-status');
const exportModal = document.getElementById('exportModal');
const modalTuVanVien = document.getElementById('modalTuVanVien');
const modalLoaiXe = document.getElementById('modalLoaiXe');
const modalMauSon = document.getElementById('modalMauSon');
const modalGiayTo = document.getElementById('modalGiayTo');
const showInterestCheckbox = document.getElementById('showInterest');
const confirmExportBtn = document.getElementById('confirmExport');
const closeExportModalBtn = document.getElementById('closeExportModal');
const cancelExportBtn = document.getElementById('cancelExport');
const exportQuoteButton = document.getElementById('export-quote-btn');

function formatMoney(value) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

function parseCurrency(value) {
    return Number(value.toString().replace(/[^0-9]/g, '')) || 0;
}

function formatNumberInput(el) {
    const digits = el.value.toString().replace(/\D/g, '');
    el.value = digits ? new Intl.NumberFormat('vi-VN').format(Number(digits)) : '';
}

function interpolateRate(x, table) {
    const sorted = [...table].sort((a, b) => a.x - b.x);
    if (x <= sorted[0].x) return sorted[0].y;
    if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;

    for (let i = 0; i < sorted.length - 1; i += 1) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (x >= current.x && x <= next.x) {
            const ratio = (x - current.x) / (next.x - current.x);
            const result = current.y + ratio * (next.y - current.y);
            const integerPart = Math.floor(result);
            return result - integerPart > 0.5 ? integerPart + 1 : integerPart;
        }
    }
    return sorted[sorted.length - 1].y;
}

function PMT(rate, periods, presentValue, futureValue = 0, type = 0) {
    if (rate === 0) {
        return -(presentValue + futureValue) / periods;
    }
    const pow = Math.pow(1 + rate, periods);
    let payment = (rate * (presentValue * pow + futureValue)) / (pow - 1);
    if (type === 1) {
        payment /= 1 + rate;
    }
    return payment;
}

function roundup1000(value) {
    return Math.ceil(value / 1000) * 1000;
}

function updateCurrencyInput(el) {
    const oldValue = el.value;
    const cursorPosition = el.selectionStart || 0;
    const digitsBeforeCursor = oldValue.slice(0, cursorPosition).replace(/\D/g, '').length;
    const rawValue = oldValue.replace(/\D/g, '');
    const formatted = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    el.value = formatted;

    let newCursor = formatted.length;
    if (digitsBeforeCursor > 0) {
        let count = 0;
        for (let i = 0; i < formatted.length; i += 1) {
            if (/\d/.test(formatted[i])) {
                count += 1;
            }
            if (count >= digitsBeforeCursor) {
                newCursor = i + 1;
                break;
            }
        }
    }

    el.setSelectionRange(newCursor, newCursor);
}

function updateDownpaymentPercent() {
    const price = parseCurrency(vehiclePriceInput.value);
    const downpayment = parseCurrency(downpaymentInput.value);
    if (!price) {
        downpaymentPercentInput.value = '';
        return;
    }
    downpaymentPercentInput.value = ((downpayment / price) * 100).toFixed(2);
}

function updateDownpaymentValue() {
    const price = parseCurrency(vehiclePriceInput.value);
    const percent = Number(downpaymentPercentInput.value) || 0;
    if (!price) {
        downpaymentInput.value = '';
        return;
    }
    downpaymentInput.value = formatMoney((price * percent) / 100);
}

function genTraTienSuggest() {
    const gia = parseCurrency(vehiclePriceInput.value);
    if (!gia) return;

    const percentStart = parseFloat(downpaymentPercentInput.value) || 10;
    let list = [];
    for (let p = percentStart; p <= 80; p += 10) list.push(gia * (p / 100));

    const v = parseCurrency(downpaymentInput.value);
    if (v > 0) {
        list.push(Math.round(v / 50000) * 50000);
        list.push(Math.round(v / 100000) * 100000);
    }

    list = [
        ...new Set(
            list
                .map((n) => Math.ceil(n / 10000) * 10000)
                .filter((n) => n > 0 && n < gia),
        ),
    ].sort((a, b) => a - b);

    const box = document.getElementById('suggestTraTien');
    if (!box) return;
    box.innerHTML = '';

    list.forEach((n) => {
        const percent = ((n / gia) * 100).toFixed(1);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'suggest-item';
        btn.innerHTML = `<span>${formatMoney(n)} ₫</span><span style="color:#1d4ed8;font-weight:600">${percent}%</span><span class="suggest-expand">…</span>`;
        const rule = getInterestRule(interestInput.value || 0);
        const minPercent = rule ? rule.minDownpaymentPercent : 0;
        if (Number(percent) < minPercent) {
            btn.disabled = true;
            btn.className += ' disabled-suggest';
            btn.title = `Yêu cầu trả trước tối thiểu ${minPercent}% cho lãi ${interestInput.value || '—'}`;
        }
        btn.onclick = () => {
            if (btn.disabled) return;
            downpaymentInput.value = formatMoney(n);
            box.innerHTML = '';
            updateDownpaymentPercent();
            calculate(true);
        };

        // expand for refined suggestions
        const expand = btn.querySelector('.suggest-expand');
        expand.addEventListener('click', (e) => {
            e.stopPropagation();
            showRefinedSuggestions(n, gia);
        });

        box.appendChild(btn);
    });
}

function showRefinedSuggestions(base, gia) {
    const box = document.getElementById('suggestTraTien');
    if (!box) return;
    box.innerHTML = '';

    const step = base < 500000 ? 10000 : 50000;
    const values = [base - 2 * step, base - step, base, base + step, base + 2 * step]
        .map((v) => Math.max(0, Math.ceil(v / 10000) * 10000))
        .filter((v) => v > 0 && v < gia);

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'suggest-back';
    back.textContent = '← Quay lại gợi ý';
    back.addEventListener('click', () => genTraTienSuggest());
    box.appendChild(back);

    values.forEach((n) => {
        const percent = ((n / gia) * 100).toFixed(1);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'suggest-item';
        btn.innerHTML = `<span>${formatMoney(n)} ₫</span><span style="color:#1d4ed8;font-weight:600">${percent}%</span>`;
        btn.onclick = () => {
            downpaymentInput.value = formatMoney(n);
            box.innerHTML = '';
            updateDownpaymentPercent();
        };
        box.appendChild(btn);
    });
}

function renderTermRows(debt, monthlyRate, loan) {
    termGrid.innerHTML = '';
    currentTerms.forEach((term) => {
        const payment = Math.abs(PMT(monthlyRate, term, debt));
        const monthlyPayment = roundup1000(payment) + 17000;
        const card = document.createElement('article');
        // thêm tính tiền lãi chênh lệch so với mua tiền mặt
        const cashPayment = monthlyPayment * term - loan;
        console.log(cashPayment)
        const cashDiff = cashPayment
        card.className = 'term-card';
        // card.innerHTML = `<div><strong>${term} tháng</strong><span> Kỳ hạn cố định</span></div>
        //     <div><strong>${formatMoney(monthlyPayment)} ₫</strong></div>`;
        card.innerHTML = `<div><strong>${term} tháng</strong><span> Kỳ hạn cố định</span></div>
            <div><strong>${formatMoney(monthlyPayment)} ₫</strong><span> (chênh ${formatMoney(cashDiff)} ₫ so với tiền mặt)</span></div>`;
        termGrid.appendChild(card);
    });
}

function renderInterestOptions() {
    const container = document.getElementById('interest-options');
    if (!container) return;
    container.innerHTML = '';
    // ensure unique, sorted x values
    const xs = [...new Set(interestLookup.map((it) => it.x))].sort((a, b) => a - b);
    xs.forEach((x) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'interest-option-btn';
        btn.textContent = x;
        btn.addEventListener('click', () => {
            interestInput.value = x;
            applyInterestRules(Number(x));
            const annual = interpolateRate(Number(x), interestLookup);
            annualRateInput.value = `${annual.toFixed(2)}%`;
            highlightInterestButton(x);
            calculate(true);
        });
        container.appendChild(btn);
    });
}

function highlightInterestButton(val) {
    const container = document.getElementById('interest-options');
    if (!container) return;
    Array.from(container.children).forEach((btn) => {
        if (btn.textContent === String(val)) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

function showResults(loan, insurance, totalDebt) {
    loanAmountEl.textContent = `${formatMoney(loan)} ₫`;
    insuranceAmountEl.textContent = `${formatMoney(insurance)} ₫`;
    totalDebtEl.textContent = `${formatMoney(totalDebt)} ₫`;
    resultStatus.textContent = 'Đã tính xong';
    resultStatus.style.background = '#e7f0ff';
    resultStatus.style.color = '#1d4ed8';
}

function hasValidLoanData() {
    const price = parseCurrency(vehiclePriceInput.value);
    const downpayment = parseCurrency(downpaymentInput.value);
    return price > 0 && downpayment > 0 && downpayment < price;
}

function openExportModal() {
    calculate(true);
    if (!hasValidLoanData()) {
        alert('Chưa có dữ liệu hợp lệ để xuất báo giá.');
        return;
    }
    const modal = new bootstrap.Modal(exportModal);
    modal.show();
}

async function confirmExport() {
    const tuVanVien = modalTuVanVien.value.trim();
    if (tuVanVien) {
        localStorage.setItem('tuVanVien', tuVanVien);
    }
    await exportQuote();
    const instance = bootstrap.Modal.getInstance(exportModal);
    if (instance) {
        instance.hide();
    }
}

async function exportQuote() {
    const price = parseCurrency(vehiclePriceInput.value);
    const downpayment = parseCurrency(downpaymentInput.value);
    const interestValue = Number(interestInput.value) || 0;
    if (!price || price <= 0 || downpayment <= 0 || downpayment >= price) {
        alert('Chưa có dữ liệu hợp lệ để xuất báo giá');
        return;
    }

    const loan = price - downpayment;
    const insurance = loan * 0.07;
    const totalDebt = loan + insurance;
    const annualRate = interpolateRate(interestValue, interestLookup);
    const monthlyRate = annualRate / 100 / 12;

    const tuVanVien = modalTuVanVien.value.trim();
    const loaiXe = modalLoaiXe.value.trim().toUpperCase();
    const mauSon = modalMauSon.value.trim();
    const giayTo = modalGiayTo.value.trim();

    const exportDiv = document.createElement('div');
    exportDiv.style.width = '600px';
    exportDiv.style.padding = '30px';
    exportDiv.style.background = '#fff';
    exportDiv.style.fontFamily = 'Times New Roman';
    exportDiv.style.fontSize = '26px';
    exportDiv.style.lineHeight = '1.6';

    const planLines = currentTerms
        .map((term) => {
            const payment = Math.abs(PMT(monthlyRate, term, totalDebt));
            const monthlyPayment = roundup1000(payment) + 17000;
            const totalInterest = showInterestCheckbox.checked
                ? ` | Lãi: ${formatMoney(monthlyPayment * term - loan)} ₫`
                : '';
            return `${term} THÁNG: ${formatMoney(monthlyPayment)} ₫${totalInterest}`;
        })
        .join('<br>');

    exportDiv.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <img src="./logo_fe.png" style="max-width:170px;" />
        ${tuVanVien ? `<div style="font-size:26px;font-weight:bold">${tuVanVien}</div>` : ''}
      </div>
      ${loaiXe ? `<b>LOẠI XE:</b> ${loaiXe}<br>` : ''}
      <b>GIÁ XE:</b> ${formatMoney(price)} ₫<br>
      <b>TRẢ TRƯỚC:</b> ${formatMoney(downpayment)} ₫<br>
      <b>KHOẢN VAY:</b> ${formatMoney(loan)} ₫<br>
      ${mauSon ? `<b>MÀU SƠN:</b> ${mauSon} <br>` : ''}
      ${giayTo ? `<b>GIẤY TỜ:</b> ${giayTo} <br>` : ''}
      <hr style="margin:10px 0;">
      ${planLines}
      <br><br>
      <b>THỦ TỤC:</b> CCCD CHIP + ĐTDĐ
    `;

    exportDiv.style.position = 'fixed';
    exportDiv.style.left = '-9999px';
    document.body.appendChild(exportDiv);

    const canvas = await html2canvas(exportDiv, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
    });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [105, 148] });
    pdf.addImage(imgData, 'PNG', 0, 0, 105, 148);
    pdf.save('bang-tra-gop-hdsaison.pdf');

    document.body.removeChild(exportDiv);
}

function calculate(isAuto = false) {
    const price = parseCurrency(vehiclePriceInput.value);
    const downpayment = parseCurrency(downpaymentInput.value);
    const interestValue = Number(interestInput.value) || 0;
    if (!price || price <= 0) {
        if (!isAuto) {
            alert('Vui lòng nhập Giá xe hợp lệ.');
            vehiclePriceInput.focus();
        } else {
            resultStatus.textContent = 'Chưa có dữ liệu';
        }
        return;
    }
    if (downpayment < 0 || downpayment > price) {
        if (!isAuto) {
            alert('Trả trước phải lớn hơn 0 và nhỏ hơn giá xe.');
            downpaymentInput.focus();
        } else {
            resultStatus.textContent = 'Trả trước không hợp lệ';
        }
        return;
    }
    // validate against interest-specific rules
    const curPercent = price ? (downpayment / price) * 100 : 0;
    const rule = getInterestRule(interestValue);
    if (rule && curPercent < rule.minDownpaymentPercent) {
        const msg = `Với lãi ${interestValue}, yêu cầu trả trước tối thiểu ${rule.minDownpaymentPercent}%`;
        if (!isAuto) {
            alert(msg);
            downpaymentInput.focus();
        } else {
            resultStatus.textContent = msg;
            resultStatus.style.background = '#fff4f4';
            resultStatus.style.color = '#dc2626';
        }
        return;
    }
    const loan = price - downpayment;
    const insurance = loan * 0.07;
    const totalDebt = loan + insurance;
    const annualRate = interpolateRate(interestValue, interestLookup);
    annualRateInput.value = `${annualRate.toFixed(2)}%`;
    const monthlyRate = annualRate / 100 / 12;
    renderTermRows(totalDebt, monthlyRate, loan);
    showResults(loan, insurance, totalDebt);
    return true;
}

[vehiclePriceInput, downpaymentInput].forEach((input) => {
    input.addEventListener('input', (event) => {
        updateCurrencyInput(event.target);
        updateDownpaymentPercent();
        genTraTienSuggest();
        calculate(true);
    });
    input.addEventListener('focus', () => genTraTienSuggest());
});

downpaymentPercentInput.addEventListener('input', () => {
    updateDownpaymentValue();
    genTraTienSuggest();
    calculate(true);
});

interestInput.addEventListener('input', () => {
    const rate = Number(interestInput.value) || 0;
    applyInterestRules(rate);
    annualRateInput.value = `${interpolateRate(rate, interestLookup).toFixed(2)}%`;
    highlightInterestButton(interestInput.value);
    calculate(true);
});

window.addEventListener('DOMContentLoaded', () => {
    const savedTuVanVien = localStorage.getItem('tuVanVien');
    if (savedTuVanVien) {
        modalTuVanVien.value = savedTuVanVien;
    }
    modalMauSon.addEventListener('input', () => formatNumberInput(modalMauSon));
    modalGiayTo.addEventListener('input', () => formatNumberInput(modalGiayTo));

    applyInterestRules(Number(interestInput.value) || 0);
    renderTermRows(0, 0, 0);
    genTraTienSuggest();
    renderInterestOptions();
});
