const terms = [6, 9, 12, 15, 18, 21, 24, 36];
const interestLookup = [
    { x: 0.49, y: 10.6 },
    { x: 0.69, y: 15.5 },
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

const vehiclePriceInput = document.getElementById('vehicle-price');
const downpaymentInput = document.getElementById('downpayment');
const downpaymentPercentInput = document.getElementById('downpayment-percent');
const interestInput = document.getElementById('interest-input');
const annualRateInput = document.getElementById('annual-rate');
const calculateButton = document.getElementById('calculate-btn');
const termGrid = document.getElementById('term-grid');
const loanAmountEl = document.getElementById('loan-amount');
const insuranceAmountEl = document.getElementById('insurance-amount');
const totalDebtEl = document.getElementById('total-debt');
const resultStatus = document.getElementById('result-status');

function formatMoney(value) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

function parseCurrency(value) {
    return Number(value.toString().replace(/[^0-9]/g, '')) || 0;
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

function renderTermRows(debt, monthlyRate) {
    termGrid.innerHTML = '';
    terms.forEach((term) => {
        const payment = Math.abs(PMT(monthlyRate, term, debt));
        const monthlyPayment = roundup1000(payment) + 17000;
        const card = document.createElement('article');
        card.className = 'term-card';
        card.innerHTML = `<div><strong>${term} tháng</strong><span> Kỳ hạn cố định</span></div>
            <div><strong>${formatMoney(monthlyPayment)} ₫</strong></div>`;
        termGrid.appendChild(card);
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

function calculate() {
    const price = parseCurrency(vehiclePriceInput.value);
    const downpayment = parseCurrency(downpaymentInput.value);
    const interestValue = Number(interestInput.value) || 0;
    if (!price || price <= 0) {
        alert('Vui lòng nhập Giá xe hợp lệ.');
        vehiclePriceInput.focus();
        return;
    }
    if (downpayment < 0 || downpayment > price) {
        alert('Trả trước phải lớn hơn 0 và nhỏ hơn giá xe.');
        downpaymentInput.focus();
        return;
    }
    const loan = price - downpayment;
    const insurance = loan * 0.07;
    const totalDebt = loan + insurance;
    const annualRate = interpolateRate(interestValue, interestLookup);
    annualRateInput.value = `${annualRate.toFixed(2)}%`;
    const monthlyRate = annualRate / 100 / 12;
    renderTermRows(totalDebt, monthlyRate);
    showResults(loan, insurance, totalDebt);
}

[vehiclePriceInput, downpaymentInput].forEach((input) => {
    input.addEventListener('input', (event) => {
        updateCurrencyInput(event.target);
        updateDownpaymentPercent();
    });
});

downpaymentPercentInput.addEventListener('input', () => {
    updateDownpaymentValue();
});

interestInput.addEventListener('input', () => {
    const rate = Number(interestInput.value) || 0;
    annualRateInput.value = `${interpolateRate(rate, interestLookup).toFixed(2)}%`;
});

calculateButton.addEventListener('click', calculate);

window.addEventListener('load', () => {
    renderTermRows(0, 0);
});
