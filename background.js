// Background service worker for DeepSeek Job Assistant

// Configuration
const API_ENDPOINT = "https://api.deepseek.com/v1/chat/completions"; // DeepSeek Chat Completion API endpoint
let apiKey = "";

// Initialize context menu when extension is installed or browser starts
chrome.runtime.onInstalled.addListener(createContextMenus);
chrome.runtime.onStartup.addListener(createContextMenus);

// Function to create context menus
function createContextMenus() {
  // Clear existing menus first to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    // Create context menu item for answering questions
    chrome.contextMenus.create({
      id: "deepseek-response",
      title: "Answer with DeepSeek",
      contexts: ["selection"]
    });

    // Create context menu for cover letter generation at the same level
    chrome.contextMenus.create({
      id: "deepseek-cover-letter",
      title: "Generate Cover Letter",
      contexts: ["all"] // Use "all" to make it appear in all contexts
    });
    
    // Context management submenu
    chrome.contextMenus.create({
      id: "deepseek-context-menu",
      title: "Job Context Management",
      contexts: ["all"]
    });
    
    // Submenu items for context management
    chrome.contextMenus.create({
      id: "deepseek-save-job-context",
      title: "Add Page Content to Context",
      parentId: "deepseek-context-menu",
      contexts: ["all"]
    });
    
    chrome.contextMenus.create({
      id: "deepseek-clear-job-context",
      title: "Clear Saved Context",
      parentId: "deepseek-context-menu",
      contexts: ["all"]
    });
  });
}

// Function to check if content script is loaded in a tab
async function ensureContentScriptLoaded(tabId) {
  return new Promise((resolve) => {
    // Try to send a simple ping message to check if content script is loaded
    chrome.tabs.sendMessage(tabId, { action: "ping" }, response => {
      // If there's no error and we got a pong response, content script is loaded
      if (chrome.runtime.lastError) {
        console.log("Content script not loaded, injecting now:", chrome.runtime.lastError.message);
        
        // Inject the content script
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["content.js"]
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("Failed to inject content script:", chrome.runtime.lastError.message);
            resolve(false);
          } else {
            console.log("Content script injected successfully");
            // Give it a moment to initialize
            setTimeout(() => resolve(true), 100);
          }
        });
      } else {
        console.log("Content script already loaded");
        resolve(true);
      }
    });
  });
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "deepseek-response" && info.selectionText) {
    // Get stored CV from storage
    chrome.storage.local.get(["cv", "apiKey"], async function(data) {
      if (!data.cv) {
        await ensureContentScriptLoaded(tab.id);
        notifyUser(tab.id, "Please add your CV in the extension popup first");
        return;
      }
      
      if (!data.apiKey) {
        await ensureContentScriptLoaded(tab.id);
        notifyUser(tab.id, "Please add your DeepSeek API key in the extension popup");
        return;
      }
      
      apiKey = data.apiKey;
      
      // Ensure content script is loaded before trying to use it
      const contentLoaded = await ensureContentScriptLoaded(tab.id);
      if (!contentLoaded) {
        console.error("Could not load content script");
        return;
      }
      
      // Generate response for selected text
      generateResponse(info.selectionText, data.cv, tab.id);
    });
  } else if (info.menuItemId === "deepseek-cover-letter") {
    // Ensure content script is loaded
    const contentLoaded = await ensureContentScriptLoaded(tab.id);
    if (!contentLoaded) {
      console.error("Could not load content script");
      return;
    }
    
    // Get stored job description and context
    chrome.storage.local.get(["cv", "apiKey", "savedJobDescription"], async function(data) {
      if (!data.cv) {
        notifyUser(tab.id, "Please add your CV in the extension popup first");
        return;
      }
      
      if (!data.apiKey) {
        notifyUser(tab.id, "Please add your DeepSeek API key in the extension popup");
        return;
      }
      
      apiKey = data.apiKey;
      
      // Request job description from content script if we don't have context
      if (!data.savedJobDescription) {
        chrome.tabs.sendMessage(tab.id, { action: "getJobDescription" }, response => {
          if (chrome.runtime.lastError || !response || !response.jobDescription) {
            notifyUser(tab.id, "Couldn't detect a job description on this page");
            return;
          }
          
          // Generate cover letter using the detected job description
          generateCoverLetter(response.jobDescription, data.cv, tab.id);
        });
      } else {
        // Use the saved context if available
        notifyUser(tab.id, "Generating cover letter using saved context...");
        generateCoverLetter(data.savedJobDescription, data.cv, tab.id);
      }
    });
  } else if (info.menuItemId === "deepseek-save-job-context") {
    // Ensure content script is loaded
    const contentLoaded = await ensureContentScriptLoaded(tab.id);
    if (!contentLoaded) {
      console.error("Could not load content script");
      return;
    }
    
    // Request job description from content script
    chrome.tabs.sendMessage(tab.id, { action: "getJobDescription" }, response => {
      if (chrome.runtime.lastError) {
        console.error("Error getting job description:", chrome.runtime.lastError.message);
        return;
      }
      
      if (!response || !response.jobDescription) {
        notifyUser(tab.id, "Couldn't detect job-related content on this page");
        return;
      }

      // Append to existing job context
      chrome.storage.local.get(['savedJobDescription'], function(data) {
        let updatedContext = '';
        const extractedContent = response.jobDescription;
        
        if (data.savedJobDescription) {
          updatedContext = data.savedJobDescription + '\n\n--- Additional Context from ' + tab.title + ' ---\n\n' + extractedContent;
        } else {
          updatedContext = '--- Context from ' + tab.title + ' ---\n\n' + extractedContent;
        }
        
        // Save updated job description to storage
        chrome.storage.local.set({ 
          savedJobDescription: updatedContext,
          // Remove separate jobDescription to avoid confusion
          jobDescription: null
        }, function() {
          notifyUser(tab.id, "Content added to context! View it in the Saved Context tab.");
        });
      });
    });
  } else if (info.menuItemId === "deepseek-clear-job-context") {
    // Clear saved job context
    chrome.storage.local.remove(['savedJobDescription', 'jobDescription'], function() {
      notifyUser(tab.id, "Job context cleared successfully.");
    });
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateCoverLetter") {
    chrome.storage.local.get(["cv", "apiKey"], function(data) {
      if (!data.cv || !data.apiKey) {
        sendResponse({ success: false, message: "CV or API key not found" });
        return;
      }
      
      apiKey = data.apiKey;
      
      // Generate cover letter using job description from request
      generateCoverLetter(request.jobDescription, data.cv)
        .then(coverLetter => {
          sendResponse({ success: true, coverLetter });
        })
        .catch(error => {
          sendResponse({ success: false, message: error.message });
        });
    });
    return true; // Keep the message channel open for async response
  }
});

// Function to generate a response using DeepSeek API
async function generateResponse(selectedText, cv, tabId) {
  try {
    // Show loading notification - ensure it's showing before anything else happens
    await notifyUser(tabId, "Processing with DeepSeek...", true);
    
    try {
      // Get any saved context to include in the response
      const data = await new Promise(resolve => {
        chrome.storage.local.get(['savedJobDescription'], resolve);
      });
      
      const companyContext = data.savedJobDescription || '';
      const hasContext = companyContext.trim().length > 0;
      
      const systemMessage = `You are a human assistant helping with job applications. Your task is to provide professional responses to job application questions based on the user's CV${hasContext ? ' and understanding of the company context' : ''}.`;
      
      let userMessage = `Please provide a professional response to the following job application question:
      
Question: ${selectedText}

My CV information:
${cv}`;

      if (hasContext) {
        userMessage += `

Company context information:
${companyContext}`;
      }
      
      userMessage += `

Generate a concise, compelling response that highlights relevant skills and experiences from my CV${hasContext ? ' while demonstrating understanding of the company culture and values' : ''}.`;
      
      // Make the API call - the notification should stay visible during this time
      const response = await callDeepSeekAPI(systemMessage, userMessage);
      
      // Only hide the notification when we have a response
      await hideNotification(tabId);
      
      // Copy response to clipboard
      await copyToClipboard(response, tabId);
      
      // Show the success notification
      await notifyUser(tabId, `Response generated ${hasContext ? 'with company context ' : ''}and copied to clipboard!`);
    } catch (innerError) {
      // If something fails during processing, make sure to hide the loading notification
      await hideNotification(tabId);
      throw innerError; // Re-throw to be caught by the outer catch
    }
  } catch (error) {
    console.error("Error generating response:", error);
    await hideNotification(tabId);
    await notifyUser(tabId, "Error generating response. Please try again.");
  }
}

// Function to generate a cover letter using DeepSeek API
async function generateCoverLetter(jobDescription, cv, tabId = null) {
  try {
    if (tabId) {
      // Show loading notification and ensure it's visible
      await notifyUser(tabId, "Processing with DeepSeek...", true);
    }
    
    try {
      const systemMessage = `You are a human assistant helping with job applications. Your task is to create professional cover letters based on job descriptions and CVs.`;
      
      const userMessage = `Please create a professional cover letter based on the following job description and CV:
      
Job Description:
${jobDescription}

My CV information:
${cv}

Generate a customized cover letter that matches my relevant skills and experiences from my CV to the key requirements in the job description. Keep it professional, concise, and compelling.`;
      
      // Make the API call
      const coverLetter = await callDeepSeekAPI(systemMessage, userMessage);
      
      if (tabId) {
        // Only hide the notification when the response is ready
        await hideNotification(tabId);
        
        // Copy cover letter to clipboard
        await copyToClipboard(coverLetter, tabId);
        
        // Show success notification
        await notifyUser(tabId, "Cover letter generated and copied to clipboard!");
      }
      
      return coverLetter;
    } catch (innerError) {
      // If we're showing UI notifications, make sure to handle errors properly
      if (tabId) {
        await hideNotification(tabId);
      }
      throw innerError; // Re-throw for outer catch
    }
  } catch (error) {
    console.error("Error generating cover letter:", error);
    if (tabId) {
      await notifyUser(tabId, "Error generating cover letter. Please try again.");
    }
    throw error;
  }
}

// Function to call DeepSeek API
async function callDeepSeekAPI(systemMessage, userMessage) {
  try {
    // Get the user's model preference and word count, defaulting if not set
    const userData = await new Promise(resolve => {
      chrome.storage.local.get(['modelSelection', 'maxWordCount'], data => {
        resolve({
          model: data.modelSelection || 'deepseek-chat',
          maxWordCount: data.maxWordCount || 300
        });
      });
    });


    let enhancedSystemMessage = systemMessage;
    // Make sure no one knows the user is making use of AI. Make it sound like a human. Don't include any markdown formatting elements in the response. It should be a plain text response.
    enhancedSystemMessage += `\n\nMake sure to sound like a human and don't include any markdown formatting elements in the response. It should be a plain text response.`;
    
    // Add word count instruction to system message if maxWordCount is set
    if (userData.maxWordCount) {
      enhancedSystemMessage += `\n\nMake sure to keep your response concise and under ${userData.maxWordCount} words or the user will not get the job and you would have failed as an assistant and something VERY BAD will happen.`;
    }
    
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: userData.model, // Use the user's selected model
        messages: [
          {
            role: "system",
            content: enhancedSystemMessage
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });
    
    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract text from the DeepSeek API response format
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      return data.choices[0].message.content || "";
    } else {
      throw new Error("Unexpected API response format");
    }
    
  } catch (error) {
    console.error("DeepSeek API error:", error);
    throw error;
  }
}

// Function to copy text to clipboard
async function copyToClipboard(text, tabId) {
  try {
    // Send message to content script to copy text to clipboard
    chrome.tabs.sendMessage(tabId, {
      action: "copyToClipboard",
      text: text
    });
  } catch (error) {
    console.error("Error copying to clipboard:", error);
    throw error;
  }
}

// Function to send notification to content script with retry
async function notifyUser(tabId, message, isLoading = false) {
  // Ensure content script is loaded
  const contentLoaded = await ensureContentScriptLoaded(tabId);
  if (!contentLoaded) {
    console.error("Could not load content script for notification");
    return;
  }
  
  chrome.tabs.sendMessage(tabId, {
    action: "showNotification",
    message: message,
    isLoading: isLoading
  }, response => {
    if (chrome.runtime.lastError) {
      console.error("Error showing notification:", chrome.runtime.lastError.message);
    }
  });
}

// Function to hide notification
async function hideNotification(tabId) {
  // Ensure content script is loaded
  const contentLoaded = await ensureContentScriptLoaded(tabId);
  if (!contentLoaded) {
    console.error("Could not load content script to hide notification");
    return;
  }
  
  chrome.tabs.sendMessage(tabId, {
    action: "hideNotification"
  }, response => {
    if (chrome.runtime.lastError) {
      console.error("Error hiding notification:", chrome.runtime.lastError.message);
    }
  });
}