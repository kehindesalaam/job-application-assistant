// Content script for DeepSeek Job Assistant
// This script runs in the context of web pages

// Function to extract job description from the page
function extractJobDescription() {
  // Strategy 1: Look for common job description containers
  const jobContainers = document.querySelectorAll(
    '.job-description, .jobDescription, [data-testid="jobDescriptionText"], .description, ' +
    '#job-description, #jobDescriptionText, [itemprop="description"], ' +
    'section.description, .job-details, .jobbody'
  );
  
  if (jobContainers.length > 0) {
    // Take the longest container text as most likely to be the full job description
    let jobDescription = "";
    for (const container of jobContainers) {
      const text = container.textContent.trim();
      if (text.length > jobDescription.length) {
        jobDescription = text;
      }
    }
    return jobDescription;
  }
  
  // Strategy 2: Look for large text blocks that might be job descriptions
  const paragraphs = document.querySelectorAll('p');
  let largestTextBlock = "";
  
  for (const paragraph of paragraphs) {
    // Only consider visible paragraphs
    if (isElementVisible(paragraph)) {
      const text = paragraph.textContent.trim();
      if (text.length > 100 && text.length > largestTextBlock.length) {
        largestTextBlock = text;
      }
    }
  }
  
  // If we found a substantial text block, return it
  if (largestTextBlock.length > 300) {
    return largestTextBlock;
  }
  
  // Strategy 3: Look for job-related keywords in the page content
  const bodyText = document.body.textContent;
  const keywordSections = [
    "job description", "responsibilities", "requirements", 
    "qualifications", "what you'll do", "about the role", 
    "duties", "skills", "experience"
  ];
  
  // Extract paragraphs near job-related keywords
  let jobText = "";
  for (const keyword of keywordSections) {
    const keywordIndex = bodyText.toLowerCase().indexOf(keyword.toLowerCase());
    if (keywordIndex !== -1) {
      // Extract approximately 1000 characters after the keyword
      const endPos = Math.min(keywordIndex + 1000, bodyText.length);
      const section = bodyText.substring(keywordIndex, endPos);
      jobText += section + "\n\n";
    }
  }
  
  if (jobText.length > 200) {
    return jobText;
  }
  
  // If all else fails, get the page's main content
  return document.body.textContent.substring(0, 3000); // First 3000 chars
}

// Helper function to check if an element is visible
function isElementVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         element.offsetWidth > 0 && 
         element.offsetHeight > 0;
}

// Create and inject notification element
const notificationContainer = document.createElement('div');
notificationContainer.style.cssText = `
  position: fixed;
  bottom: 30px;
  right: 30px;
  background-color: #4a4a4a;
  color: white;
  padding: 15px 20px;
  border-radius: 5px;
  z-index: 10000;
  font-family: Arial, sans-serif;
  max-width: 300px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  transition: opacity 0.3s ease-in-out;
  opacity: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
`;
document.body.appendChild(notificationContainer);

// Create spinner element for loading animation
const spinnerElement = document.createElement('div');
spinnerElement.style.cssText = `
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top: 2px solid white;
  width: 16px;
  height: 16px;
  margin-right: 10px;
  animation: deepseek-spin 1s linear infinite;
  display: none;
`;

// Add the spinner animation
const styleElement = document.createElement('style');
styleElement.textContent = `
  @keyframes deepseek-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleElement);

// Add spinner to notification container
notificationContainer.appendChild(spinnerElement);

// Create message element
const messageElement = document.createElement('div');
notificationContainer.appendChild(messageElement);

// Function to show notification
function showNotification(message, duration = 3000, isLoading = false) {
  // Clear any existing timers for hiding notifications
  if (window.notificationTimer) {
    clearTimeout(window.notificationTimer);
    window.notificationTimer = null;
  }
  
  spinnerElement.style.display = isLoading ? 'block' : 'none';
  messageElement.textContent = message;
  notificationContainer.style.opacity = '1';
  
  // Only auto-hide if not a loading notification
  if (!isLoading) {
    window.notificationTimer = setTimeout(() => {
      notificationContainer.style.opacity = '0';
    }, duration);
  }
  
  // Log the notification state for debugging
  console.log(`Notification shown: "${message}", isLoading: ${isLoading}`);
}

// Function to hide notification
function hideNotification() {
  // Clear any existing timers
  if (window.notificationTimer) {
    clearTimeout(window.notificationTimer);
    window.notificationTimer = null;
  }
  
  notificationContainer.style.opacity = '0';
  console.log("Notification hidden");
}

// Function to copy text to clipboard
function copyTextToClipboard(text) {
  // Create a temporary textarea element
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';  // Prevent scrolling to bottom
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    // Execute copy command
    const successful = document.execCommand('copy');
    if (successful) {
      return true;
    } else {
      console.error('Unable to copy text with execCommand');
      return false;
    }
  } catch (err) {
    console.error('Error copying text: ', err);
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    // This is just a ping to check if content script is loaded
    sendResponse({ status: "pong" });
  } else if (request.action === "getJobDescription") {
    const jobDescription = extractJobDescription();
    sendResponse({ jobDescription });
  } else if (request.action === "showNotification") {
    showNotification(request.message, 3000, request.isLoading || false);
    sendResponse({ success: true });
  } else if (request.action === "hideNotification") {
    hideNotification();
    sendResponse({ success: true });
  } else if (request.action === "copyToClipboard") {
    const success = copyTextToClipboard(request.text);
    if (success) {
      showNotification("Copied to clipboard!");
    } else {
      showNotification("Failed to copy to clipboard.");
    }
    sendResponse({ success });
  }
  
  // Return true if you're using sendResponse asynchronously
  return true;
});