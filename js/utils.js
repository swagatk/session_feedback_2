// Function to export data to Excel using SheetJS
export function exportToExcel(data, fileName) {
    // data should be an array of objects
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Responses");
    XLSX.writeFile(workbook, fileName + ".xlsx");
}

// Function to export HTML element to PDF using html2pdf.js
export function exportToPDF(elementId, fileName) {
    const element = document.getElementById(elementId);
    const opt = {
        margin:       1,
        filename:     fileName + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}
