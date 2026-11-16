'use strict';

// The same fictional roster is used by the dashboard, attendance, and records pages.
const STUDENTS = [
  { id: 'HMS2026001', name: 'Aarav Mehta', room: 'A-101' },
  { id: 'HMS2026002', name: 'Ananya Rao', room: 'A-102' },
  { id: 'HMS2026003', name: 'Kabir Sharma', room: 'A-103' },
  { id: 'HMS2026004', name: 'Diya Nair', room: 'A-104' },
  { id: 'HMS2026005', name: 'Ishaan Verma', room: 'B-201' },
  { id: 'HMS2026006', name: 'Meera Iyer', room: 'B-202' },
  { id: 'HMS2026007', name: 'Rohan Das', room: 'B-203' },
  { id: 'HMS2026008', name: 'Sana Khan', room: 'B-204' },
  { id: 'HMS2026009', name: 'Arjun Patel', room: 'C-301' },
  { id: 'HMS2026010', name: 'Tara Joseph', room: 'C-302' }
];

const STORAGE_KEY = 'hostelAttendanceRecords';

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && getLocalDateString(date) === value;
}

function formatDate(value, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!isValidDateString(value)) return value;
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${value}T00:00:00`));
}

function showMessage(element, text, type = 'success') {
  if (!element) return;
  element.textContent = text;
  element.className = `message ${type}`;
}

function hideMessage(element) {
  if (!element) return;
  element.textContent = '';
  element.className = 'message hidden';
}

function loadAttendanceData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return { records: {}, warning: '' };

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { records: {}, warning: 'Saved attendance data has an invalid format and was not loaded. Saving new attendance will replace it.' };
    }

    const records = {};
    let foundInvalidEntry = false;
    Object.entries(parsed).forEach(([date, entries]) => {
      if (!isValidDateString(date) || !entries || typeof entries !== 'object' || Array.isArray(entries)) {
        foundInvalidEntry = true;
        return;
      }
      const validEntries = {};
      Object.entries(entries).forEach(([studentId, status]) => {
        const isKnownStudent = STUDENTS.some((student) => student.id === studentId);
        if (isKnownStudent && (status === 'Present' || status === 'Absent')) {
          validEntries[studentId] = status;
        } else {
          foundInvalidEntry = true;
        }
      });
      if (Object.keys(validEntries).length > 0) records[date] = validEntries;
      if (Object.keys(validEntries).length !== Object.keys(entries).length) foundInvalidEntry = true;
    });

    return {
      records,
      warning: foundInvalidEntry ? 'Some invalid saved attendance entries were ignored.' : ''
    };
  } catch (error) {
    return {
      records: {},
      warning: error instanceof SyntaxError
        ? 'Saved attendance data could not be read because its format is invalid.'
        : 'Attendance storage is unavailable in this browser.'
    };
  }
}

function saveAttendanceData(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch (error) {
    return false;
  }
}

function showStorageWarning(warning) {
  const element = document.getElementById('global-message');
  if (warning) showMessage(element, warning, 'warning');
  else hideMessage(element);
}

function initializeDashboard(records) {
  const today = getLocalDateString();
  const todaysEntries = records[today] || {};
  const present = Object.values(todaysEntries).filter((status) => status === 'Present').length;
  const absent = Object.values(todaysEntries).filter((status) => status === 'Absent').length;
  const marked = present + absent;
  const unmarked = STUDENTS.length - marked;
  const rate = marked === 0 ? 0 : Math.round((present / marked) * 100);

  document.getElementById('today-date').textContent = formatDate(today, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  document.getElementById('summary-date').textContent = formatDate(today);
  document.getElementById('total-students').textContent = String(STUDENTS.length);
  document.getElementById('present-count').textContent = String(present);
  document.getElementById('absent-count').textContent = String(absent);
  document.getElementById('attendance-rate').textContent = `${rate}%`;
  document.getElementById('summary-present').textContent = String(present);
  document.getElementById('summary-absent').textContent = String(absent);
  document.getElementById('summary-unmarked').textContent = String(unmarked);
  document.getElementById('summary-progress').style.width = `${(marked / STUDENTS.length) * 100}%`;
  document.getElementById('completion-caption').textContent = `${marked} of ${STUDENTS.length} students recorded`;
  document.getElementById('summary-message').textContent = marked === 0
    ? 'No attendance has been recorded for today yet.'
    : marked === STUDENTS.length
      ? `Attendance is complete for all ${STUDENTS.length} students today.`
      : `Attendance has been recorded for ${marked} of ${STUDENTS.length} students today.`;
}

function initializeAttendance(records) {
  const dateInput = document.getElementById('attendance-date');
  const searchInput = document.getElementById('student-search');
  const list = document.getElementById('student-list');
  const emptyState = document.getElementById('student-empty');
  const statusMessage = document.getElementById('attendance-message');
  const selection = {};
  let selectedDate = getLocalDateString();

  dateInput.value = selectedDate;
  document.getElementById('roster-count').textContent = String(STUDENTS.length);

  function loadSelectedDate() {
    Object.keys(selection).forEach((studentId) => delete selection[studentId]);
    Object.assign(selection, records[selectedDate] || {});
    hideMessage(statusMessage);
    renderStudents();
  }

  function renderStudents() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const matchingStudents = STUDENTS.filter((student) =>
      student.name.toLocaleLowerCase().includes(query) || student.id.toLocaleLowerCase().includes(query)
    );

    list.replaceChildren();
    matchingStudents.forEach((student) => {
      const row = document.createElement('tr');
      const studentCell = document.createElement('td');
      studentCell.className = 'student-cell';
      studentCell.dataset.label = 'Student';
      studentCell.innerHTML = `<div class="student-name">${student.name}</div><div class="student-sub">${student.id} · Room ${student.room}</div>`;

      const idCell = document.createElement('td');
      idCell.dataset.label = 'Student ID';
      idCell.innerHTML = `<span class="id-text">${student.id}</span>`;

      const roomCell = document.createElement('td');
      roomCell.dataset.label = 'Room';
      roomCell.innerHTML = `<span class="room-text">${student.room}</span>`;

      const statusCell = document.createElement('td');
      statusCell.className = 'status-cell';
      statusCell.dataset.label = 'Attendance status';
      const controls = document.createElement('div');
      controls.className = 'status-controls';
      ['Present', 'Absent'].forEach((status) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `status-button ${status.toLowerCase()}${selection[student.id] === status ? ' selected' : ''}`;
        button.setAttribute('aria-pressed', String(selection[student.id] === status));
        button.setAttribute('aria-label', `${status} for ${student.name}`);
        button.innerHTML = `${status === 'Present' ? '✓' : '×'} ${status}`;
        button.addEventListener('click', () => {
          selection[student.id] = status;
          hideMessage(statusMessage);
          renderStudents();
        });
        controls.append(button);
      });
      statusCell.append(controls);
      row.append(studentCell, idCell, roomCell, statusCell);
      list.append(row);
    });

    emptyState.classList.toggle('hidden', matchingStudents.length > 0);
    document.getElementById('selection-count').textContent = String(Object.keys(selection).length);
  }

  dateInput.addEventListener('change', () => {
    if (!isValidDateString(dateInput.value)) {
      showMessage(statusMessage, 'Choose a valid attendance date.', 'error');
      dateInput.value = selectedDate;
      return;
    }
    selectedDate = dateInput.value;
    loadSelectedDate();
  });

  searchInput.addEventListener('input', renderStudents);

  document.getElementById('clear-selection').addEventListener('click', () => {
    if (Object.keys(selection).length === 0) {
      showMessage(statusMessage, 'There are no selected statuses to clear.', 'warning');
      return;
    }
    if (!window.confirm('Clear the current selections for this date? Saved attendance records will not be changed.')) return;
    Object.keys(selection).forEach((studentId) => delete selection[studentId]);
    hideMessage(statusMessage);
    renderStudents();
  });

  document.getElementById('save-attendance').addEventListener('click', () => {
    const missing = STUDENTS.filter((student) => !selection[student.id]);
    if (missing.length > 0) {
      showMessage(statusMessage, `Attendance is incomplete. Please mark all ${STUDENTS.length} students. ${missing.length} still need a status.`, 'error');
      return;
    }

    const nextRecords = { ...records, [selectedDate]: {} };
    STUDENTS.forEach((student) => {
      nextRecords[selectedDate][student.id] = selection[student.id];
    });
    if (!saveAttendanceData(nextRecords)) {
      showMessage(statusMessage, 'Attendance could not be saved. Check that browser storage is enabled and try again.', 'error');
      return;
    }
    Object.keys(records).forEach((date) => delete records[date]);
    Object.assign(records, nextRecords);
    showMessage(statusMessage, `Attendance for ${formatDate(selectedDate)} saved successfully. You can edit and save this date again at any time.`, 'success');
    renderStudents();
  });

  loadSelectedDate();
}

function initializeRecords(records) {
  const searchInput = document.getElementById('records-search');
  const dateFilter = document.getElementById('date-filter');
  const statusFilter = document.getElementById('status-filter');
  const list = document.getElementById('records-list');
  const emptyState = document.getElementById('records-empty');
  const allRows = [];

  const studentTotals = {};
  STUDENTS.forEach((student) => { studentTotals[student.id] = { present: 0, recorded: 0 }; });
  Object.entries(records).forEach(([, entries]) => {
    Object.entries(entries).forEach(([studentId, status]) => {
      if (!studentTotals[studentId]) return;
      studentTotals[studentId].recorded += 1;
      if (status === 'Present') studentTotals[studentId].present += 1;
    });
  });

  Object.entries(records).forEach(([date, entries]) => {
    Object.entries(entries).forEach(([studentId, status]) => {
      const student = STUDENTS.find((item) => item.id === studentId);
      if (!student) return;
      const totals = studentTotals[studentId];
      allRows.push({
        student,
        date,
        status,
        percentage: totals.recorded === 0 ? 0 : Math.round((totals.present / totals.recorded) * 100),
        recorded: totals.recorded
      });
    });
  });
  allRows.sort((a, b) => b.date.localeCompare(a.date) || a.student.name.localeCompare(b.student.name));

  document.getElementById('record-count').textContent = String(allRows.length);
  document.getElementById('students-with-records').textContent = String(Object.values(studentTotals).filter((item) => item.recorded > 0).length);

  function renderRecords() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const chosenDate = dateFilter.value;
    const chosenStatus = statusFilter.value;
    const filteredRows = allRows.filter(({ student, date, status }) =>
      (student.name.toLocaleLowerCase().includes(query) || student.id.toLocaleLowerCase().includes(query)) &&
      (!chosenDate || date === chosenDate) &&
      (chosenStatus === 'all' || status === chosenStatus)
    );
    list.replaceChildren();

    filteredRows.forEach(({ student, date, status, percentage, recorded }) => {
      const row = document.createElement('tr');
      const studentCell = document.createElement('td');
      studentCell.className = 'student-cell';
      studentCell.dataset.label = 'Student';
      studentCell.innerHTML = `<span class="student-name">${student.name}</span>`;

      const idCell = document.createElement('td');
      idCell.dataset.label = 'Student ID';
      idCell.innerHTML = `<span class="id-text">${student.id}</span>`;

      const roomCell = document.createElement('td');
      roomCell.dataset.label = 'Room';
      roomCell.innerHTML = `<span class="room-text">${student.room}</span>`;

      const dateCell = document.createElement('td');
      dateCell.className = 'date-cell';
      dateCell.dataset.label = 'Attendance date';
      dateCell.textContent = formatDate(date);

      const statusCell = document.createElement('td');
      statusCell.dataset.label = 'Status';
      statusCell.innerHTML = `<span class="status-badge ${status.toLowerCase()}">${status === 'Present' ? '✓' : '×'} ${status}</span>`;

      const rateCell = document.createElement('td');
      rateCell.className = 'rate-cell';
      rateCell.dataset.label = 'Student attendance';
      rateCell.innerHTML = `<div class="rate-value"><span>${percentage}%</span><span>${studentTotals[student.id].present}/${recorded} days present</span></div><div class="rate-track"><span style="width: ${percentage}%"></span></div>`;

      row.append(studentCell, idCell, roomCell, dateCell, statusCell, rateCell);
      list.append(row);
    });

    emptyState.classList.toggle('hidden', filteredRows.length > 0);
    document.getElementById('records-result-count').textContent = `Showing ${filteredRows.length} ${filteredRows.length === 1 ? 'entry' : 'entries'}`;
  }

  searchInput.addEventListener('input', renderRecords);
  dateFilter.addEventListener('input', renderRecords);
  statusFilter.addEventListener('change', renderRecords);
  renderRecords();
}

document.addEventListener('DOMContentLoaded', () => {
  const { records, warning } = loadAttendanceData();
  showStorageWarning(warning);
  const page = document.body.dataset.page;
  if (page === 'dashboard') initializeDashboard(records);
  if (page === 'attendance') initializeAttendance(records);
  if (page === 'records') initializeRecords(records);
});
