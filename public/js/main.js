document.addEventListener("DOMContentLoaded", () => {
  // Check if user is logged in
  const sessionToken = localStorage.getItem("sessionToken")
  if (!sessionToken) {
    window.location.href = "/welcome"
    return
  }

  // Global variables
  let currentUser = {
    username: localStorage.getItem("username"),
    balance: Number.parseFloat(localStorage.getItem("balance") || "0"),
  }
  let matches = []
  let betslip = []
  let betHistory = []
  let standings = []
  let leaderboard = []

  // Initialize UI
  initUI()

  // Validate session and load user data
  validateSession()

  // Load initial data
  loadMatches()
  loadBetHistory()
  loadStandings()
  loadLeaderboard()

  // Set up refresh intervals
  setInterval(loadMatches, 30000) // Refresh matches every 30 seconds
  setInterval(updateCountdowns, 1000) // Update countdowns every second

  // Navigation
  document.querySelectorAll(".main-nav a").forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault()
      const section = this.getAttribute("data-section")

      // Update active nav item
      document.querySelectorAll(".main-nav li").forEach((item) => {
        item.classList.remove("active")
      })
      this.parentElement.classList.add("active")

      // Show selected section
      document.querySelectorAll(".content-section").forEach((section) => {
        section.classList.remove("active")
      })
      document.getElementById(section).classList.add("active")
    })
  })

  // Logout button
  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("sessionToken")
    localStorage.removeItem("username")
    localStorage.removeItem("balance")
    window.location.href = "/welcome"
  })

  // Clear betslip button
  document.getElementById("clear-betslip").addEventListener("click", () => {
    betslip = []
    updateBetslip()
    showNotification("Betslip cleared", "info")
  })

  // Place bet button
  document.getElementById("place-bet-btn").addEventListener("click", () => {
    const stake = Number.parseFloat(document.getElementById("stake-amount").value)

    if (isNaN(stake) || stake <= 0) {
      showNotification("Please enter a valid stake amount", "error")
      return
    }

    if (stake > currentUser.balance) {
      showNotification("Insufficient balance", "error")
      return
    }

    if (betslip.length === 0) {
      showNotification("Your betslip is empty", "error")
      return
    }

    // Prepare bet selections
    const betSelections = betslip.map((item) => ({
      matchId: item.matchId,
      market: item.market,
      option: item.option,
    }))

    // Send place bet request
    fetch("/api/bet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        username: currentUser.username,
        betSelections,
        stake,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          showNotification("Bet placed successfully!", "success")

          // Update user balance
          currentUser.balance -= stake
          localStorage.setItem("balance", currentUser.balance.toString())
          updateUserInfo()

          // Clear betslip
          betslip = []
          updateBetslip()

          // Reload bet history
          loadBetHistory()
        } else {
          showNotification(data.error || "Failed to place bet", "error")
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        showNotification("An error occurred. Please try again later.", "error")
      })
  })

  // Stake amount input
  document.getElementById("stake-amount").addEventListener("input", () => {
    updatePotentialWin()
  })

  // Initialize UI elements
  function initUI() {
    document.getElementById("username").textContent = currentUser.username
    updateUserInfo()
  }

  // Update user info in UI
  function updateUserInfo() {
    document.getElementById("user-balance").textContent = currentUser.balance.toFixed(2)
  }

  // Validate user session
  function validateSession() {
    fetch("/api/validate-session", {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          currentUser = data.user
          localStorage.setItem("balance", currentUser.balance.toString())
          updateUserInfo()
        } else {
          // Invalid session, redirect to login
          localStorage.removeItem("sessionToken")
          localStorage.removeItem("username")
          localStorage.removeItem("balance")
          window.location.href = "/welcome"
        }
      })
      .catch((error) => {
        console.error("Error:", error)
      })
  }

  // Load matches data
  function loadMatches() {
    fetch("/api/matches")
      .then((response) => response.json())
      .then((data) => {
        console.log("Matches data received:", data)
        // Make sure data is an array
        matches = Array.isArray(data) ? data : []
        renderMatches()
      })
      .catch((error) => {
        console.error("Error loading matches:", error)
        document.getElementById("matches-container").innerHTML =
          '<div class="no-data">Error loading matches. Please try again later.</div>'
        document.getElementById("live-matches-container").innerHTML =
          '<div class="no-data">Error loading matches. Please try again later.</div>'
      })
  }

  // Render matches in UI
  function renderMatches() {
    try {
      const matchesContainer = document.getElementById("matches-container")
      const liveMatchesContainer = document.getElementById("live-matches-container")

      // Clear containers
      matchesContainer.innerHTML = ""
      liveMatchesContainer.innerHTML = ""

      if (!matches || matches.length === 0) {
        matchesContainer.innerHTML = '<div class="no-data">No upcoming matches available</div>'
        liveMatchesContainer.innerHTML = '<div class="no-data">No live matches available</div>'
        return
      }

      // Sort matches by end time
      matches.sort((a, b) => new Date(a.endTime) - new Date(b.endTime))

      // Filter live matches (less than 90 minutes remaining)
      const liveMatches = matches.filter((match) => {
        if (!match.endTime) return false
        const timeRemaining = (new Date(match.endTime) - new Date()) / (1000 * 60)
        return timeRemaining < 90 && timeRemaining > 0
      })

      // Render upcoming matches
      if (matches.length === 0) {
        matchesContainer.innerHTML = '<div class="no-data">No upcoming matches available</div>'
      } else {
        matches.forEach((match) => {
          matchesContainer.appendChild(createMatchCard(match))
        })
      }

      // Render live matches
      if (liveMatches.length === 0) {
        liveMatchesContainer.innerHTML = '<div class="no-data">No live matches available</div>'
      } else {
        liveMatches.forEach((match) => {
          liveMatchesContainer.appendChild(createMatchCard(match, true))
        })
      }
    } catch (error) {
      console.error("Error rendering matches:", error)
      document.getElementById("matches-container").innerHTML =
        '<div class="no-data">Error rendering matches. Please try again later.</div>'
      document.getElementById("live-matches-container").innerHTML =
        '<div class="no-data">Error rendering matches. Please try again later.</div>'
    }
  }

  // Create match card element
  function createMatchCard(match, isLive = false) {
    try {
      const matchCard = document.createElement("div")
      matchCard.className = "match-card"

      // Safely get match properties with fallbacks
      const home = match.home || "Unknown Team"
      const away = match.away || "Unknown Team"
      const result = match.result || "Pending"
      const endTime = match.endTime ? new Date(match.endTime) : new Date()
      const matchId = match.matchId || "unknown"

      // Safely get possession and corners with fallbacks
      const possession = match.possession || {}
      const homePos = possession[home] || "50%"
      const awayPos = possession[away] || "50%"

      const corners = match.corners || {}
      const homeCorners = corners[home] || 0
      const awayCorners = corners[away] || 0

      // Calculate time remaining
      const now = new Date()
      const timeRemaining = Math.max(0, (endTime - now) / 1000)
      const minutesRemaining = Math.floor(timeRemaining / 60)
      const secondsRemaining = Math.floor(timeRemaining % 60)

      // Format time string
      const timeString = isLive
        ? `<span class="live-indicator">● LIVE</span> ${minutesRemaining}:${secondsRemaining < 10 ? "0" : ""}${secondsRemaining}`
        : endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

      // Match header
      const matchHeader = document.createElement("div")
      matchHeader.className = "match-header"
      matchHeader.innerHTML = `
      <div class="match-time">
        <i class="fas fa-clock"></i>
        <span class="time-display" data-end-time="${endTime.toISOString()}">${timeString}</span>
      </div>
      <div class="match-id">ID: ${matchId.substring(0, 8)}</div>
    `

      // Match teams - Don't show scores
      const matchTeams = document.createElement("div")
      matchTeams.className = "match-teams"
      matchTeams.innerHTML = `
      <div class="team home-team">
        <div class="team-name">${home}</div>
      </div>
      <div class="vs">VS</div>
      <div class="team away-team">
        <div class="team-name">${away}</div>
      </div>
    `

      // Match stats
      const matchStats = document.createElement("div")
      matchStats.className = "match-stats"
      matchStats.innerHTML = `
      <div class="stat">
        <div class="stat-label">Possession</div>
        <div class="stat-value">${homePos}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Corners</div>
        <div class="stat-value">${homeCorners} - ${awayCorners}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Betting</div>
        <div class="stat-value">${match.bettingOpen ? "Open" : "Closed"}</div>
      </div>
    `

      // Match markets
      const matchMarkets = document.createElement("div")
      matchMarkets.className = "match-markets"

      // Add markets if they exist
      if (match.markets) {
        for (const [marketKey, marketOptions] of Object.entries(match.markets)) {
          const market = document.createElement("div")
          market.className = "market"

          // Format market title
          const marketTitle = marketKey.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())

          market.innerHTML = `<div class="market-title">${marketTitle}</div>`

          const marketOptionsDiv = document.createElement("div")
          marketOptionsDiv.className = "market-options"

          for (const [optionKey, optionData] of Object.entries(marketOptions)) {
            const betOption = document.createElement("div")
            betOption.className = "bet-option"

            // Check if this option is in betslip
            const isSelected = betslip.some(
              (item) => item.matchId === match.matchId && item.market === marketKey && item.option === optionKey,
            )

            if (isSelected) {
              betOption.classList.add("selected")
            }

            const odds = optionData && typeof optionData.odds === "number" ? optionData.odds : 1.0

            betOption.innerHTML = `
            <span class="bet-option-name">${optionKey}</span>
            <span class="bet-option-odds">${odds.toFixed(2)}</span>
          `

            // Add click event to add/remove from betslip
            betOption.addEventListener("click", function () {
              // Check if betting is open
              if (!match.bettingOpen) {
                showNotification("Betting is closed for this match", "error")
                return
              }

              // Check if match is about to end (less than 1 minute)
              const timeToEnd = (new Date(match.endTime) - new Date()) / (1000 * 60)
              if (timeToEnd < 1) {
                showNotification("Betting is closed for this match (less than 1 minute remaining)", "error")
                return
              }

              toggleBetSelection(match, marketKey, optionKey, odds)

              // Toggle selected class
              this.classList.toggle("selected")
            })

            marketOptionsDiv.appendChild(betOption)
          }

          market.appendChild(marketOptionsDiv)
          matchMarkets.appendChild(market)
        }
      } else {
        matchMarkets.innerHTML = '<div class="no-data">No betting markets available</div>'
      }

      // Assemble match card
      matchCard.appendChild(matchHeader)
      matchCard.appendChild(matchTeams)
      matchCard.appendChild(matchStats)
      matchCard.appendChild(matchMarkets)

      return matchCard
    } catch (error) {
      console.error("Error creating match card:", error, match)
      const errorCard = document.createElement("div")
      errorCard.className = "match-card"
      errorCard.innerHTML = '<div class="no-data">Error displaying match</div>'
      return errorCard
    }
  }

  // Toggle bet selection in betslip
  function toggleBetSelection(match, market, option, odds) {
    // Check if this selection is already in betslip
    const existingIndex = betslip.findIndex(
      (item) => item.matchId === match.matchId && item.market === market && item.option === option,
    )

    if (existingIndex !== -1) {
      // Remove from betslip
      betslip.splice(existingIndex, 1)
      showNotification(`Removed ${option} from betslip`, "info")
    } else {
      // Check for conflicting bets on the same match
      const conflictingIndex = betslip.findIndex((item) => item.matchId === match.matchId && item.market === market)

      if (conflictingIndex !== -1) {
        // Remove conflicting bet
        betslip.splice(conflictingIndex, 1)
      }

      // Add to betslip
      betslip.push({
        matchId: match.matchId,
        matchName: `${match.home} vs ${match.away}`,
        market,
        option,
        odds,
      })

      showNotification(`Added ${option} to betslip`, "success")
    }

    // Update betslip UI
    updateBetslip()
  }

  // Update betslip UI
  function updateBetslip() {
    const betslipContent = document.getElementById("betslip-content")
    const betslipCount = document.getElementById("betslip-count")
    const placeBetBtn = document.getElementById("place-bet-btn")

    // Update count
    betslipCount.textContent = betslip.length

    // Enable/disable place bet button
    placeBetBtn.disabled = betslip.length === 0

    // Clear betslip content
    betslipContent.innerHTML = ""

    if (betslip.length === 0) {
      betslipContent.innerHTML = '<div class="empty-betslip">Your betslip is empty</div>'
    } else {
      // Add each bet to betslip
      betslip.forEach((bet, index) => {
        const betslipItem = document.createElement("div")
        betslipItem.className = "betslip-item"

        betslipItem.innerHTML = `
                    <div class="betslip-item-header">
                        <div class="betslip-teams">${bet.matchName}</div>
                        <i class="fas fa-times remove-bet" data-index="${index}"></i>
                    </div>
                    <div class="betslip-selection">
                        <div class="selection-details">
                            <div>${bet.option}</div>
                            <div class="selection-market">${bet.market.replace(/_/g, " ")}</div>
                        </div>
                        <div class="selection-odds">${bet.odds.toFixed(2)}</div>
                    </div>
                `

        betslipContent.appendChild(betslipItem)
      })

      // Add remove bet event listeners
      document.querySelectorAll(".remove-bet").forEach((btn) => {
        btn.addEventListener("click", function () {
          const index = Number.parseInt(this.getAttribute("data-index"))
          betslip.splice(index, 1)
          updateBetslip()
          showNotification("Removed selection from betslip", "info")

          // Update selected class on bet options
          renderMatches()
        })
      })
    }

    // Update total odds and potential win
    updateTotalOdds()
    updatePotentialWin()
  }

  // Update total odds
  function updateTotalOdds() {
    const totalOddsElement = document.getElementById("total-odds")

    if (betslip.length === 0) {
      totalOddsElement.textContent = "0.00"
      return
    }

    // Calculate total odds
    const totalOdds = betslip.reduce((acc, bet) => acc * bet.odds, 1)
    totalOddsElement.textContent = totalOdds.toFixed(2)
  }

  // Update potential win
  function updatePotentialWin() {
    const potentialWinElement = document.getElementById("potential-win")
    const stakeAmount = Number.parseFloat(document.getElementById("stake-amount").value) || 0

    if (betslip.length === 0 || stakeAmount === 0) {
      potentialWinElement.textContent = "0.00"
      return
    }

    // Calculate total odds
    const totalOdds = betslip.reduce((acc, bet) => acc * bet.odds, 1)

    // Calculate potential win
    const potentialWin = stakeAmount * totalOdds
    potentialWinElement.textContent = potentialWin.toFixed(2)
  }

  // Load bet history
  function loadBetHistory() {
    fetch(`/api/bet-history/${currentUser.username}`)
      .then((response) => response.json())
      .then((data) => {
        betHistory = data
        renderBetHistory()
      })
      .catch((error) => {
        console.error("Error:", error)
      })
  }

  // Render bet history
  function renderBetHistory() {
    const historyContainer = document.getElementById("history-container")

    // Clear container
    historyContainer.innerHTML = ""

    if (!betHistory || betHistory.length === 0) {
      historyContainer.innerHTML = '<div class="no-data">No bet history available</div>'
      return
    }

    // Sort by placed time (newest first)
    betHistory.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))

    // Render each bet
    betHistory.forEach((bet) => {
      try {
        const betItem = document.createElement("div")
        betItem.className = "bet-history-item"

        // Format date
        const betDate = new Date(bet.placedAt).toLocaleString()

        // Bet header
        const betHeader = document.createElement("div")
        betHeader.className = "bet-history-header"
        betHeader.innerHTML = `
        <div class="bet-id">ID: ${bet.betId.substring(0, 8)}</div>
        <div class="bet-status ${bet.status}">${bet.status.toUpperCase()}</div>
      `

        // Bet details
        const betDetails = document.createElement("div")
        betDetails.className = "bet-details"

        // Bet info
        const betInfo = document.createElement("div")
        betInfo.className = "bet-info"
        betInfo.innerHTML = `
        <div>
          <div class="bet-info-label">Stake</div>
          <div>${Number.parseFloat(bet.stake).toFixed(2)}</div>
        </div>
        <div>
          <div class="bet-info-label">Total Odds</div>
          <div>${bet.totalOdds}</div>
        </div>
        <div>
          <div class="bet-info-label">Potential Win</div>
          <div>${bet.potentialPayout}</div>
        </div>
        <div>
          <div class="bet-info-label">Date</div>
          <div>${betDate}</div>
        </div>
      `

        // Bet selections
        const betSelections = document.createElement("div")
        betSelections.className = "bet-selections"

        // Add each selection
        if (bet.selections && Array.isArray(bet.selections)) {
          bet.selections.forEach((selection) => {
            // Find match details
            const match = matches.find((m) => m.matchId === selection.matchId)

            const selectionItem = document.createElement("div")
            selectionItem.className = "bet-selection-item"

            if (match) {
              // If match is found in current matches
              const marketOption = match.markets[selection.market]?.[selection.option]
              const odds = marketOption?.odds || 0

              selectionItem.innerHTML = `
              <div class="bet-selection-teams">${match.home} vs ${match.away}</div>
              <div class="bet-selection-details">
                <div>
                  <span>${selection.option}</span>
                  <span class="bet-selection-market">${selection.market.replace(/_/g, " ")}</span>
                </div>
                <div class="selection-odds">${odds.toFixed(2)}</div>
              </div>
            `
            } else {
              // If match is not found (already finished)
              selectionItem.innerHTML = `
              <div class="bet-selection-teams">Match ID: ${selection.matchId.substring(0, 8)}</div>
              <div class="bet-selection-details">
                <div>
                  <span>${selection.option}</span>
                  <span class="bet-selection-market">${selection.market.replace(/_/g, " ")}</span>
                </div>
              </div>
            `
            }

            betSelections.appendChild(selectionItem)
          })
        }

        // Assemble bet item
        betDetails.appendChild(betInfo)
        betDetails.appendChild(betSelections)

        betItem.appendChild(betHeader)
        betItem.appendChild(betDetails)

        historyContainer.appendChild(betItem)
      } catch (error) {
        console.error("Error rendering bet history item:", error, bet)
      }
    })
  }

  // Load standings
  function loadStandings() {
    fetch("/api/standings")
      .then((response) => response.json())
      .then((data) => {
        standings = data
        renderStandings()
      })
      .catch((error) => {
        console.error("Error:", error)
      })
  }

  // Render standings
  function renderStandings() {
    const standingsContainer = document.getElementById("standings-container")

    // Clear container
    standingsContainer.innerHTML = ""

    if (standings.length === 0) {
      standingsContainer.innerHTML = '<div class="no-data">No standings available</div>'
      return
    }

    // Create table
    const table = document.createElement("table")
    table.className = "standings-table"

    // Table header
    const thead = document.createElement("thead")
    thead.innerHTML = `
            <tr>
                <th>#</th>
                <th>Team</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>Points</th>
            </tr>
        `

    // Table body
    const tbody = document.createElement("tbody")

    // Add each team
    standings.forEach((team, index) => {
      const row = document.createElement("tr")

      row.innerHTML = `
                <td class="standings-rank">${index + 1}</td>
                <td>${team.team}</td>
                <td>${team.wins}</td>
                <td>${team.draws}</td>
                <td>${team.losses}</td>
                <td>${team.points}</td>
            `

      tbody.appendChild(row)
    })

    // Assemble table
    table.appendChild(thead)
    table.appendChild(tbody)

    standingsContainer.appendChild(table)
  }

  // Load leaderboard
  function loadLeaderboard() {
    fetch("/api/leaderboard")
      .then((response) => response.json())
      .then((data) => {
        leaderboard = data
        renderLeaderboard()
      })
      .catch((error) => {
        console.error("Error:", error)
      })
  }

  // Render leaderboard
  function renderLeaderboard() {
    const leaderboardContainer = document.getElementById("leaderboard-container")

    // Clear container
    leaderboardContainer.innerHTML = ""

    if (leaderboard.length === 0) {
      leaderboardContainer.innerHTML = '<div class="no-data">No leaderboard available</div>'
      return
    }

    // Render each user
    leaderboard.forEach((user, index) => {
      const leaderboardItem = document.createElement("div")
      leaderboardItem.className = "leaderboard-item"

      // Add top-3 class for medal positions
      const rankClass = index < 3 ? ` top-${index + 1}` : ""

      leaderboardItem.innerHTML = `
                <div class="leaderboard-rank${rankClass}">${index + 1}</div>
                <div class="leaderboard-user">
                    <div class="leaderboard-username">${user.username}</div>
                    <div class="leaderboard-stats">
                        <div class="leaderboard-stat">Bets: ${user.totalBets}</div>
                        <div class="leaderboard-stat">Won: ${user.totalWon}</div>
                    </div>
                </div>
                <div class="leaderboard-balance">${user.balance.toFixed(2)}</div>
            `

      leaderboardContainer.appendChild(leaderboardItem)
    })
  }

  // Update countdowns
  function updateCountdowns() {
    try {
      document.querySelectorAll(".time-display").forEach((timeDisplay) => {
        const endTimeStr = timeDisplay.getAttribute("data-end-time")
        if (!endTimeStr) return

        const endTime = new Date(endTimeStr)
        const now = new Date()
        const timeRemaining = Math.max(0, (endTime - now) / 1000)

        if (timeRemaining <= 0) {
          timeDisplay.textContent = "Finished"
          return
        }

        const minutesRemaining = Math.floor(timeRemaining / 60)
        const secondsRemaining = Math.floor(timeRemaining % 60)

        // Check if this is a live match
        if (timeDisplay.innerHTML.includes("LIVE")) {
          timeDisplay.innerHTML = `<span class="live-indicator">● LIVE</span> ${minutesRemaining}:${secondsRemaining < 10 ? "0" : ""}${secondsRemaining}`
        } else if (timeRemaining < 90 * 60) {
          // Less than 90 minutes
          timeDisplay.innerHTML = `<span class="live-indicator">● LIVE</span> ${minutesRemaining}:${secondsRemaining < 10 ? "0" : ""}${secondsRemaining}`
        }
      })
    } catch (error) {
      console.error("Error updating countdowns:", error)
    }
  }

  // Show notification
  function showNotification(message, type) {
    const notification = document.getElementById("notification")
    notification.textContent = message
    notification.className = `notification ${type} show`

    // Hide notification after 3 seconds
    setTimeout(() => {
      notification.classList.remove("show")
    }, 3000)
  }
})
