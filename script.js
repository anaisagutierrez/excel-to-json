let currentJSON = [];
let fileName = null;

function getFileNameWithoutExcelExtensionImproved(fileName) {
  const lowerFileName = fileName.toLowerCase();
  const excelExtensions = ['.xlsx', '.xls']; // Define extensions in an array

  // Find the first matching extension at the end of the filename
  const foundExtension = excelExtensions.find(ext => lowerFileName.endsWith(ext));

  if (foundExtension) {
    // If an extension is found, slice the original fileName by the length of the found extension
    return fileName.slice(0, -foundExtension.length);
  } else {
    // No matching excel extension found
    return fileName;
  }
}

document.getElementById('uploadExcel').addEventListener('change', async (event) => { // Mark the event listener as async

    showLoading(); // Show the loading indicator

    try {
        const file = event.target.files[0];
        fileName = getFileNameWithoutExcelExtensionImproved(file.name)
        console.log(file.name, '---',fileName)

        if (!file) {
            console.warn("No file selected.");
            return; // Exit if no file is selected
        }

        // 1. Create a Promise to wrap the FileReader operation
        const fileContent = await new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                resolve(e.target.result); // Resolve the promise with the file content
            };

            reader.onerror = (error) => {
                reject(error); // Reject the promise if an error occurs
            };

            reader.readAsArrayBuffer(file); // Start reading the file
        });

        // 2. Once the Promise resolves (file is read), proceed with XLSX processing
        const data = new Uint8Array(fileContent);
        const workbook = XLSX.read(data, { type: 'array' });

        // Use the first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON
        currentJSON = XLSX.utils.sheet_to_json(sheet);
        document.getElementById('output').textContent = JSON.stringify(currentJSON, null, 2);

    } catch (error) {
        // Use a more specific error message for the user
        const dataContainer = document.getElementById('dataContainer'); // Ensure dataContainer is defined
        if (dataContainer) {
            dataContainer.innerHTML = `<p style="color: red;">An error occurred while processing the file: ${error.message}</p>`;
        }
        console.error("Error processing Excel file:", error);
    } finally {
        hideLoading(); // Always hide the loading indicator, whether success or failure
    }
});


document.getElementById('exportJsonBtn').addEventListener('click', () => {
  if (!currentJSON.length) return alert("No data to export. Please upload an Excel file first.");

  const blob = new Blob([JSON.stringify(currentJSON, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName + '.json';
  a.click();
  URL.revokeObjectURL(url);
});

function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}
