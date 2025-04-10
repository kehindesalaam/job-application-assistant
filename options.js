// Options page script for DeepSeek Job Assistant

document.addEventListener('DOMContentLoaded', function() {
  // Load saved CV and API key
  loadSavedData();
  
  // File upload handling
  const fileInput = document.getElementById('cv-file');
  const fileNameDisplay = document.getElementById('file-name');
  const cvTextarea = document.getElementById('cv-textarea');
  
  // Handle word count slider and input synchronization
  const wordCountSlider = document.getElementById('word-count-slider');
  const wordCountInput = document.getElementById('word-count-input');
  
  if (wordCountSlider && wordCountInput) {
    // Update input when slider changes
    wordCountSlider.addEventListener('input', function() {
      wordCountInput.value = this.value;
    });
    
    // Update slider when input changes
    wordCountInput.addEventListener('change', function() {
      let value = parseInt(this.value);
      
      // Enforce min/max constraints
      if (value < 50) value = 50;
      if (value > 1000) value = 1000;
      
      this.value = value;
      wordCountSlider.value = value;
    });
  }
  
  fileInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) {
      fileNameDisplay.textContent = 'No file selected';
      return;
    }
    
    fileNameDisplay.textContent = file.name;
    
    // Process the uploaded file
    const fileType = file.name.split('.').pop().toLowerCase();
    
    if (fileType === 'txt') {
      // For text files, directly read the content
      readTextFile(file);
    } else if (['pdf', 'doc', 'docx', 'rtf'].includes(fileType)) {
      // For other formats, show a notification that we'll extract text
      const cvStatus = document.getElementById('cv-status');
      showStatus(cvStatus, 'Extracting text from ' + fileType.toUpperCase() + ' file...', 'pending');
      
      // For simplicity in this implementation, we'll just read TXT files properly
      // Other formats would require additional libraries to parse
      if (fileType === 'pdf') {
        showStatus(cvStatus, 'PDF parsing is limited. For best results, copy-paste the text from your PDF directly.', 'pending');
        // Here we would add PDF parsing logic if using a library like pdf.js
      } else {
        showStatus(cvStatus, 'This file format may not be fully supported. For best results, copy-paste the text directly.', 'pending');
      }
      
      // For now, we'll try to read anything as text
      readTextFile(file);
    }
  });
  
  // Function to read text from file
  function readTextFile(file) {
    const reader = new FileReader();
    
    reader.onload = function(event) {
      cvTextarea.value = event.target.result;
    };
    
    reader.onerror = function() {
      const cvStatus = document.getElementById('cv-status');
      showStatus(cvStatus, 'Error reading file. Please try again or paste the text directly.', 'error');
    };
    
    reader.readAsText(file);
  }
  
  // Save CV button
  document.getElementById('save-cv').addEventListener('click', saveCV);
  
  // Save API Key button
  document.getElementById('save-api-key').addEventListener('click', saveApiKey);
  
  // Save Model Settings button
  document.getElementById('save-model-settings').addEventListener('click', saveModelSettings);
});

// Function to load saved data from storage
function loadSavedData() {
  chrome.storage.local.get(['cv', 'apiKey', 'modelSelection', 'maxWordCount'], function(data) {
    if (data.cv) {
      document.getElementById('cv-textarea').value = data.cv;
    }
    
    if (data.apiKey) {
      document.getElementById('api-key-input').value = data.apiKey;
    }
    
    // Set the model selection radio button based on saved preference
    if (data.modelSelection) {
      const radioButtons = document.querySelectorAll('input[name="model-selection"]');
      for (const radioButton of radioButtons) {
        if (radioButton.value === data.modelSelection) {
          radioButton.checked = true;
          break;
        }
      }
    }
    
    // Set the word count slider and input based on saved preference
    if (data.maxWordCount) {
      const wordCountSlider = document.getElementById('word-count-slider');
      const wordCountInput = document.getElementById('word-count-input');
      
      if (wordCountSlider && wordCountInput) {
        wordCountSlider.value = data.maxWordCount;
        wordCountInput.value = data.maxWordCount;
      }
    }
  });
}

// Function to save CV to storage
function saveCV() {
  const cvText = document.getElementById('cv-textarea').value.trim();
  const cvStatus = document.getElementById('cv-status');
  
  if (!cvText) {
    showStatus(cvStatus, 'Please enter your CV or resume text.', 'error');
    return;
  }
  
  chrome.storage.local.set({ cv: cvText }, function() {
    showStatus(cvStatus, 'CV saved successfully! Your CV is now ready to use with DeepSeek Job Assistant.', 'success');
  });
}

// Function to save API key to storage
function saveApiKey() {
  const apiKey = document.getElementById('api-key-input').value.trim();
  const apiStatus = document.getElementById('api-status');
  
  if (!apiKey) {
    showStatus(apiStatus, 'Please enter your DeepSeek API key.', 'error');
    return;
  }
  
  chrome.storage.local.set({ apiKey: apiKey }, function() {
    showStatus(apiStatus, 'API key saved successfully! You can now use all features of DeepSeek Job Assistant.', 'success');
  });
}

// Function to save model settings to storage
function saveModelSettings() {
  const selectedModel = document.querySelector('input[name="model-selection"]:checked').value;
  const maxWordCount = parseInt(document.getElementById('word-count-input').value);
  const modelStatus = document.getElementById('model-status');
  
  // Validate word count
  let validWordCount = maxWordCount;
  if (isNaN(validWordCount) || validWordCount < 50) validWordCount = 50;
  if (validWordCount > 1000) validWordCount = 1000;
  
  chrome.storage.local.set({ 
    modelSelection: selectedModel,
    maxWordCount: validWordCount
  }, function() {
    showStatus(modelStatus, `Settings saved! Using ${selectedModel === 'deepseek-chat' ? 'DeepSeek Chat' : 'DeepSeek Reasoner'} model with a maximum of ${validWordCount} words.`, 'success');
  });
}

// Helper function to show status messages
function showStatus(element, message, type) {
  element.innerHTML = message;
  element.className = 'status ' + type;
  element.style.display = 'block';
  
  // Scroll to the status message to ensure it's visible
  element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}