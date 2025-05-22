document.addEventListener("DOMContentLoaded", () => {
  // Tab switching
  const tabBtns = document.querySelectorAll(".tab-btn")
  const tabPanes = document.querySelectorAll(".tab-pane")

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      const tabId = this.getAttribute("data-tab")

      // Remove active class from all buttons and panes
      tabBtns.forEach((btn) => btn.classList.remove("active"))
      tabPanes.forEach((pane) => pane.classList.remove("active"))

      // Add active class to current button and pane
      this.classList.add("active")
      document.getElementById(tabId).classList.add("active")
    })
  })

  // Login form submission
  const loginForm = document.getElementById("login-form")
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault()

    const username = document.getElementById("login-username").value
    const password = document.getElementById("login-password").value

    // Validate inputs
    if (!username || !password) {
      showMessage("Please enter both username and password", "error")
      return
    }

    // Send login request
    fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          showMessage("Login successful! Redirecting...", "success")

          // Save session token and user data
          localStorage.setItem("sessionToken", data.sessionToken)
          localStorage.setItem("username", data.user.username)
          localStorage.setItem("balance", data.user.balance)

          // Redirect to main page after a short delay
          setTimeout(() => {
            window.location.href = "/"
          }, 1000)
        } else {
          showMessage(data.error || "Login failed. Please try again.", "error")
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        showMessage("An error occurred. Please try again later.", "error")
      })
  })

  // Register form submission
  const registerForm = document.getElementById("register-form")
  registerForm.addEventListener("submit", (e) => {
    e.preventDefault()

    const username = document.getElementById("register-username").value
    const password = document.getElementById("register-password").value
    const socials = document.getElementById("register-socials").value

    // Validate inputs
    if (!username || !password) {
      showMessage("Please enter both username and password", "error")
      return
    }

    // Send register request
    fetch("/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password, socials }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          showMessage("Registration successful! Redirecting to login...", "success")

          // Save session token and user data
          localStorage.setItem("sessionToken", data.sessionToken)
          localStorage.setItem("username", data.user.username)
          localStorage.setItem("balance", data.user.balance)

          // Redirect to main page after a short delay
          setTimeout(() => {
            window.location.href = "/"
          }, 1000)
        } else {
          showMessage(data.error || "Registration failed. Please try again.", "error")
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        showMessage("An error occurred. Please try again later.", "error")
      })
  })

  // Check if user is already logged in
  const sessionToken = localStorage.getItem("sessionToken")
  if (sessionToken) {
    // Validate session
    fetch("/api/validate-session", {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // User is already logged in, redirect to main page
          window.location.href = "/"
        } else {
          // Invalid session, clear localStorage
          localStorage.removeItem("sessionToken")
          localStorage.removeItem("username")
          localStorage.removeItem("balance")
        }
      })
      .catch((error) => {
        console.error("Error:", error)
      })
  }

  // Helper function to show messages
  function showMessage(message, type) {
    const messageElement = document.getElementById("login-message")
    messageElement.textContent = message
    messageElement.className = "message " + type
  }
})
