let currentJSON = [];
let fileName = null;

// Get references to DOM elements
const uploadExcel = document.getElementById('uploadExcel');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const validateJsonBtn = document.getElementById('validateJsonBtn'); // New button reference
const outputPre = document.getElementById('output');
const loadingOverlay = document.getElementById('loadingOverlay');

// Flag to ensure style sheet for message box is only added once
let styleSheetAdded = false;

/**
 * Extracts the file name without common Excel extensions.
 * @param {string} fileName - The full file name.
 * @returns {string} The file name without the Excel extension.
 */
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

/**
 * Sanitizes a string to ensure it's valid for JSON stringification.
 * This function replaces problematic control characters (ASCII 0-31 and 127-159)
 * with their properly escaped JSON equivalents or removes them if no standard
 * escape exists and they are truly problematic.
 *
 * JSON specification (RFC 8259) requires control characters to be escaped.
 *
 * @param {string} str The input string to sanitize.
 * @returns {string} The sanitized string.
 */
function sanitizeStringForJSON(str) {
    if (typeof str !== 'string') {
        return str; // Return non-string values as-is (numbers, booleans, null)
    }

    // Regex to find control characters (U+0000 to U+001F) and (U+007F to U+009F)
    // These are the characters that JSON.parse will complain about if unescaped.
    return str.replace(/[\x00-\x1F\x7F-\x9F]/g, function(char) {
        switch (char) {
            case '\b': return '\\b'; // Backspace
            case '\f': return '\\f'; // Form feed
            case '\n': return '\\n'; // Newline
            case '\r': return '\\r'; // Carriage return
            case '\t': return '\\t'; // Tab
            // JSON.stringify inherently escapes " and \.
            // These cases are here for completeness if manual string construction was involved,
            // but for XLSX.utils.sheet_to_json output, the above control characters are the main concern.
            case '"':  return '\\"';
            case '\\': return '\\\\';
            // For other control characters, replace with empty string.
            // This is a common strategy to remove problematic invisible characters.
            default: return '';
        }
    });
}

/**
 * Displays a custom message box instead of alert().
 * @param {string} message - The message to display.
 * @param {string} type - 'info', 'warning', 'error' for styling.
 */
function showMessageBox(message, type = 'info') {
    let messageBox = document.getElementById('customMessageBox');
    let messageContent = document.getElementById('customMessageBoxContent');

    if (!messageBox) {
        // Create message box container
        messageBox = document.createElement('div');
        messageBox.id = 'customMessageBox';
        messageBox.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 25px 35px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 2000;
            text-align: center;
            max-width: 400px;
            width: 90%;
            font-family: 'Inter', sans-serif;
            font-size: 1.1em;
            color: #333;
            animation: fadeIn 0.3s ease-out;
        `;
        document.body.appendChild(messageBox);

        // Create a dedicated element for the message content
        messageContent = document.createElement('p');
        messageContent.id = 'customMessageBoxContent';
        messageContent.style.margin = '0 0 20px 0'; // Add some bottom margin
        messageBox.appendChild(messageContent);

        // Create and append the close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'OK';
        closeButton.style.cssText = `
            padding: 10px 25px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            transition: background-color 0.2s;
        `;
        closeButton.onclick = () => messageBox.remove();
        messageBox.appendChild(closeButton);

        // Add fade-in animation style sheet only once
        if (!styleSheetAdded) {
            const styleSheet = document.createElement("style");
            styleSheet.type = "text/css";
            styleSheet.innerText = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translate(-50%, -60%); }
                    to { opacity: 1; transform: translate(-50%, -50%); }
                }
            `;
            document.head.appendChild(styleSheet);
            styleSheetAdded = true;
        }
    }

    // Update message content
    messageContent.textContent = message;

    // Set border color based on message type
    let messageColor = '#333';
    switch (type) {
        case 'warning':
            messageColor = '#ffc107';
            break;
        case 'error':
            messageColor = '#dc3545';
            break;
        case 'info':
        default:
            messageColor = '#28a745';
            break;
    }
    messageBox.style.borderColor = messageColor;
    messageBox.style.borderWidth = '2px';
    messageBox.style.borderStyle = 'solid';
}


// Function to show loading overlay
function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

// Function to hide loading overlay
function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// Event listener for file upload
uploadExcel.addEventListener('change', async (event) => {
    showLoading(); // Show the loading indicator
    outputPre.value = '';
    try {
        const file = event.target.files[0];
        if (!file) {
            console.warn("No file selected.");
            // outputPre.textContent = 'No file selected.';
            outputPre.value = 'No file selected.';
            outputPre.style.color = '#ffc107'; // Yellow for warning
            hideLoading();
            return;
        }

        fileName = getFileNameWithoutExcelExtensionImproved(file.name);
        console.log("Processing file:", file.name, "-> Base name:", fileName);

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

        // Convert to JSON and apply sanitization
        // XLSX.utils.sheet_to_json returns an array of objects
        const rawJsonData = XLSX.utils.sheet_to_json(sheet);

        // Iterate through each object and each key-value pair to sanitize string values
        currentJSON = rawJsonData.map(row => {
            const sanitizedRow = {};
            for (const key in row) {
                if (Object.hasOwnProperty.call(row, key)) {
                    let value = row[key];
                    if (typeof value === 'string') {
                        sanitizedRow[key] = sanitizeStringForJSON(value);
                    } else {
                        sanitizedRow[key] = value;
                    }
                }
            }
            return sanitizedRow;
        });

        // outputPre.textContent = JSON.stringify(currentJSON, null, 2);
        outputPre.value = JSON.stringify(currentJSON, null, 2);
        outputPre.style.color = '#333'; // Reset color
        showMessageBox('Excel file successfully loaded and converted!', 'info');
        console.log("currentJSON after conversion:", currentJSON); // Log currentJSON state

    } catch (error) {
        // outputPre.textContent = `An error occurred while processing the file: ${error.message}`;
        outputPre.value = `An error occurred while processing the file: ${error.message}`;
        
        outputPre.style.color = '#dc3545'; // Red for error
        console.error("Error processing Excel file:", error);
        showMessageBox(`Error processing Excel file: ${error.message}`, 'error');
    } finally {
        hideLoading(); // Always hide the loading indicator, whether success or failure
    }
});


// Event listener for JSON export button
exportJsonBtn.addEventListener('click', () => {
    console.log("Export JSON button clicked.");
    console.log("currentJSON length:", currentJSON.length);

    if (!currentJSON.length) {
        showMessageBox("No data to export. Please upload an Excel file first.", 'warning');
        console.log("Export aborted: currentJSON is empty.");
        return;
    }

    try {
        const jsonString = JSON.stringify(currentJSON, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (fileName || 'exported_data') + '.json'; // Use 'exported_data' as fallback
        document.body.appendChild(a); // Append to body to ensure it's clickable in all browsers
        a.click();
        document.body.removeChild(a); // Clean up the temporary anchor tag
        URL.revokeObjectURL(url); // Release the object URL
        showMessageBox('JSON file successfully exported!', 'info');
        console.log("JSON export successful.");
    } catch (error) {
        console.error("Error exporting JSON:", error);
        showMessageBox(`Error exporting JSON: ${error.message}`, 'error');
    }
});

// New Event listener for JSON validation button
if (validateJsonBtn) { // Ensure the button exists before adding listener
    validateJsonBtn.addEventListener('click', () => {
        console.log("Validate JSON button clicked.");
        console.log("currentJSON length for validation:", currentJSON.length);

        if (!currentJSON.length) {
            showMessageBox("No JSON data to validate. Please upload an Excel file and convert it first.", 'warning');
            console.log("Validation aborted: currentJSON is empty.");
            return;
        }

        try {
            // Attempt to stringify and then parse the current JSON data
            // const testString = JSON.stringify(currentJSON);
            const testString = outputPre.value; 
            JSON.parse(testString);
            showMessageBox("JSON is valid!", 'info');
            console.log("JSON validation successful.");
        } catch (error) {
            console.error("JSON validation error:", error);
            showMessageBox(`JSON validation failed: ${error.message}`, 'error');
        }
    });
}

