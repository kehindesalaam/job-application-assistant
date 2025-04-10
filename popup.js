// Popup script for DeepSeek Job Assistant

document.addEventListener('DOMContentLoaded', function() {
  // Tab navigation
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      // Show corresponding content
      const contentId = tab.id.replace('-tab', '-content');
      document.getElementById(contentId).classList.add('active');
    });
  });
  
  // Load saved CV, API key, and job description
  loadSavedData();
  
  // Check for saved context and update UI indicator
  updateContextTabIndicator();
  
  // Handle word count slider and input synchronization in popup
  const popupWordCountSlider = document.getElementById('popup-word-count-slider');
  const popupWordCountInput = document.getElementById('popup-word-count-input');
  
  if (popupWordCountSlider && popupWordCountInput) {
    // Update input when slider changes
    popupWordCountSlider.addEventListener('input', function() {
      popupWordCountInput.value = this.value;
    });
    
    // Update slider when input changes
    popupWordCountInput.addEventListener('change', function() {
      let value = parseInt(this.value);
      
      // Enforce min/max constraints
      if (value < 50) value = 50;
      if (value > 1000) value = 1000;
      
      this.value = value;
      popupWordCountSlider.value = value;
    });
  }
  
  // File upload handling
  const fileInput = document.getElementById('cv-file');
  const fileNameDisplay = document.getElementById('file-name');
  const cvTextarea = document.getElementById('cv-textarea');
  
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
  
  // Save API Settings button (replaces the Save API Key button)
  document.getElementById('save-api-settings').addEventListener('click', saveAPISettings);
  
  // Extract job description button
  document.getElementById('extract-job').addEventListener('click', extractJobDescription);
  
  // Generate cover letter button
  document.getElementById('generate-cover-letter').addEventListener('click', generateCoverLetter);
  
  // Copy result button
  document.getElementById('copy-result').addEventListener('click', copyResultToClipboard);
  
  // Check if we have saved job description button
  document.getElementById('check-saved-context').addEventListener('click', checkSavedJobContext);
  
  // Generate cover letter from saved context button
  document.getElementById('generate-from-saved').addEventListener('click', generateFromSavedContext);

  // Context tab buttons
  document.getElementById('refresh-context').addEventListener('click', refreshSavedContext);
  document.getElementById('clear-context').addEventListener('click', clearSavedContext);
});

// Function to load saved data from storage
function loadSavedData() {
  chrome.storage.local.get(['cv', 'apiKey', 'jobDescription', 'savedJobDescription', 'modelSelection', 'maxWordCount'], function(data) {
    if (data.cv) {
      document.getElementById('cv-textarea').value = data.cv;
    }
    
    if (data.apiKey) {
      document.getElementById('api-key-input').value = data.apiKey;
    }
    
    if (data.jobDescription) {
      document.getElementById('job-description').value = data.jobDescription;
    }
    
    if (data.savedJobDescription) {
      document.getElementById('saved-context-textarea').value = data.savedJobDescription;
    }
    
    // Set the model selection radio button based on saved preference
    if (data.modelSelection) {
      const radioButtons = document.querySelectorAll('input[name="popup-model-selection"]');
      for (const radioButton of radioButtons) {
        if (radioButton.value === data.modelSelection) {
          radioButton.checked = true;
          break;
        }
      }
    }
    
    // Set the word count slider and input based on saved preference
    if (data.maxWordCount) {
      const wordCountSlider = document.getElementById('popup-word-count-slider');
      const wordCountInput = document.getElementById('popup-word-count-input');
      
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
    showStatus(cvStatus, 'CV saved successfully!', 'success');
  });
}

// Function to save API settings to storage (both API key and model selection)
function saveAPISettings() {
  const apiKey = document.getElementById('api-key-input').value.trim();
  const selectedModel = document.querySelector('input[name="popup-model-selection"]:checked').value;
  const maxWordCount = parseInt(document.getElementById('popup-word-count-input').value);
  const apiStatus = document.getElementById('api-status');
  
  if (!apiKey) {
    showStatus(apiStatus, 'Please enter your DeepSeek API key.', 'error');
    return;
  }
  
  // Validate word count
  let validWordCount = maxWordCount;
  if (isNaN(validWordCount) || validWordCount < 50) validWordCount = 50;
  if (validWordCount > 1000) validWordCount = 1000;
  
  // Save API key, model selection, and max word count
  chrome.storage.local.set({ 
    apiKey: apiKey,
    modelSelection: selectedModel,
    maxWordCount: validWordCount
  }, function() {
    showStatus(apiStatus, `Settings saved! Using ${selectedModel === 'deepseek-chat' ? 'DeepSeek Chat' : 'DeepSeek Reasoner'} model with a maximum of ${validWordCount} words.`, 'success');
  });
}

// Function to extract job description from active tab
function extractJobDescription() {
  const jobDescriptionTextarea = document.getElementById('job-description');
  const coverLetterStatus = document.getElementById('cover-letter-status');
  
  showStatus(coverLetterStatus, 'Extracting job description...', 'pending');
  
  // Query the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs[0]) {
      showStatus(coverLetterStatus, 'No active tab found.', 'error');
      return;
    }
    
    // Send message to content script to get job description
    chrome.tabs.sendMessage(tabs[0].id, { action: "getJobDescription" }, function(response) {
      if (chrome.runtime.lastError) {
        showStatus(coverLetterStatus, 'Error: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      
      if (!response || !response.jobDescription) {
        showStatus(coverLetterStatus, 'No job description found on this page.', 'error');
        return;
      }
      
      // Update textarea with job description
      jobDescriptionTextarea.value = response.jobDescription;
      
      // Also append to the savedJobDescription context if the option is checked
      const appendToContextCheck = document.getElementById('append-to-context-check');
      
      if (appendToContextCheck && appendToContextCheck.checked) {
        // Append to existing job context
        chrome.storage.local.get(['savedJobDescription'], function(data) {
          let updatedContext = '';
          const pageTitle = tabs[0].title || 'Current Page';
          
          if (data.savedJobDescription) {
            updatedContext = data.savedJobDescription + '\n\n--- Additional Context from ' + pageTitle + ' ---\n\n' + response.jobDescription;
          } else {
            updatedContext = '--- Context from ' + pageTitle + ' ---\n\n' + response.jobDescription;
          }
          
          // Save updated context and refresh the context indicator
          chrome.storage.local.set({ savedJobDescription: updatedContext }, function() {
            showStatus(coverLetterStatus, 'Job description extracted and added to saved context!', 'success');
            updateContextTabIndicator();
          });
        });
      } else {
        showStatus(coverLetterStatus, 'Job description extracted successfully!', 'success');
      }
    });
  });
}

// Function to generate cover letter
function generateCoverLetter() {
  const jobDescription = document.getElementById('job-description').value.trim();
  const coverLetterStatus = document.getElementById('cover-letter-status');
  const resultContainer = document.getElementById('result-container');
  const resultTextarea = document.getElementById('result-textarea');
  
  if (!jobDescription) {
    showStatus(coverLetterStatus, 'Please enter or extract a job description.', 'error');
    return;
  }
  
  // Check if CV and API key are available
  chrome.storage.local.get(['cv', 'apiKey', 'savedJobDescription'], function(data) {
    if (!data.cv) {
      showStatus(coverLetterStatus, 'Please add your CV in the CV Management tab first.', 'error');
      return;
    }
    
    if (!data.apiKey) {
      showStatus(coverLetterStatus, 'Please add your DeepSeek API key in the API Settings tab first.', 'error');
      return;
    }
    
    // Show loading state
    showStatus(coverLetterStatus, '<div class="loading"></div> Generating cover letter...', 'pending');
    
    // Use a combination of extracted job description and any saved context
    let contextToUse = jobDescription;
    if (data.savedJobDescription) {
      const useExistingContextCheck = document.getElementById('use-existing-context-check');
      if (useExistingContextCheck && useExistingContextCheck.checked) {
        contextToUse = data.savedJobDescription;
        showStatus(coverLetterStatus, '<div class="loading"></div> Using saved context for cover letter generation...', 'pending');
      }
    }
    
    // Send message to background script to generate cover letter
    chrome.runtime.sendMessage({
      action: "generateCoverLetter",
      jobDescription: contextToUse
    }, function(response) {
      if (!response || !response.success) {
        showStatus(coverLetterStatus, 'Error: ' + (response?.message || 'Failed to generate cover letter.'), 'error');
        return;
      }
      
      // Hide status and show result
      coverLetterStatus.style.display = 'none';
      resultContainer.style.display = 'block';
      resultTextarea.value = response.coverLetter;
      
      // Automatically copy to clipboard
      copyResultToClipboard();
      
      // Show a subtle notification that text was copied
      showCopyNotification();
    });
  });
}

// Function to generate cover letter from saved context
function generateFromSavedContext() {
  const coverLetterStatus = document.getElementById('cover-letter-status');
  const resultContainer = document.getElementById('result-container');
  const resultTextarea = document.getElementById('result-textarea');
  
  // Check if CV, API key, and saved context are available
  chrome.storage.local.get(['cv', 'apiKey', 'savedJobDescription'], function(data) {
    if (!data.cv) {
      showStatus(coverLetterStatus, 'Please add your CV in the CV Management tab first.', 'error');
      return;
    }
    
    if (!data.apiKey) {
      showStatus(coverLetterStatus, 'Please add your DeepSeek API key in the API Settings tab first.', 'error');
      return;
    }
    
    if (!data.savedJobDescription) {
      showStatus(coverLetterStatus, 'No saved context found. Add content using the context menu or extraction options.', 'error');
      return;
    }
    
    // Show loading state
    showStatus(coverLetterStatus, '<div class="loading"></div> Generating cover letter from saved context...', 'pending');
    
    // Send message to background script to generate cover letter using saved context
    chrome.runtime.sendMessage({
      action: "generateCoverLetter",
      jobDescription: data.savedJobDescription
    }, function(response) {
      if (!response || !response.success) {
        showStatus(coverLetterStatus, 'Error: ' + (response?.message || 'Failed to generate cover letter.'), 'error');
        return;
      }
      
      // Hide status and show result
      coverLetterStatus.style.display = 'none';
      resultContainer.style.display = 'block';
      resultTextarea.value = response.coverLetter;
      
      // Automatically copy to clipboard
      copyResultToClipboard();
      
      // Show a subtle notification that text was copied
      showCopyNotification();
    });
  });
}

// Function to check saved job context
function checkSavedJobContext() {
  const coverLetterStatus = document.getElementById('cover-letter-status');
  
  chrome.storage.local.get(['cv', 'apiKey', 'savedJobDescription'], function(data) {
    if (!data.cv) {
      showStatus(coverLetterStatus, 'No CV found in storage.', 'error');
      return;
    }
    
    if (!data.apiKey) {
      showStatus(coverLetterStatus, 'No API key found in storage.', 'error');
      return;
    }
    
    if (!data.savedJobDescription) {
      showStatus(coverLetterStatus, 'No saved context found. Add content using the context menu or extraction options.', 'error');
      return;
    }
    
    // Use context and show status
    document.getElementById('use-existing-context-check').checked = true;
    showStatus(coverLetterStatus, 'Found saved context! It will be used when generating the cover letter.', 'success');
    
    // Switch to the context tab to show the user what's available
    document.getElementById('context-tab').click();
  });
}

// Function to copy result to clipboard
function copyResultToClipboard() {
  const resultTextarea = document.getElementById('result-textarea');
  const copyNotification = document.getElementById('copy-notification');
  
  resultTextarea.select();
  document.execCommand('copy');
  
  // Show copy notification
  copyNotification.classList.add('visible');
  setTimeout(() => {
    copyNotification.classList.remove('visible');
  }, 2000);
}

// Function to refresh saved context view
function refreshSavedContext() {
  const contextStatus = document.getElementById('context-status');
  const savedContextTextarea = document.getElementById('saved-context-textarea');
  
  chrome.storage.local.get(['savedJobDescription'], function(data) {
    if (data.savedJobDescription) {
      savedContextTextarea.value = data.savedJobDescription;
      
      // Count the number of context entries
      const contextEntries = (data.savedJobDescription.match(/--- (Additional )?Context from/g) || []).length;
      
      showStatus(contextStatus, `Context refreshed! You have ${contextEntries} page${contextEntries !== 1 ? 's' : ''} of context information.`, 'success');
      updateContextTabIndicator();
    } else {
      savedContextTextarea.value = '';
      showStatus(contextStatus, 'No saved context found. Use the context menu or extraction options to collect job information.', 'error');
    }
  });
}

// Function to clear saved context
function clearSavedContext() {
  const contextStatus = document.getElementById('context-status');
  const savedContextTextarea = document.getElementById('saved-context-textarea');
  
  chrome.storage.local.remove(['savedJobDescription', 'jobDescription'], function() {
    savedContextTextarea.value = '';
    showStatus(contextStatus, 'All saved context has been cleared successfully!', 'success');
    updateContextTabIndicator();
  });
}

// Function to update the context tab indicator
function updateContextTabIndicator() {
  chrome.storage.local.get(['savedJobDescription'], function(data) {
    const contextTab = document.getElementById('context-tab');
    if (data.savedJobDescription && data.savedJobDescription.trim().length > 0) {
      contextTab.classList.add('has-content');
    } else {
      contextTab.classList.remove('has-content');
    }
  });
}

// Helper function to show status messages
function showStatus(element, message, type) {
  element.innerHTML = message;
  element.className = 'status ' + type;
  element.style.display = 'block';
}