// 2017.03.01 Started

var Instance, // PuSplitter.deployed()
    Errors,
    SendBtn,
    RefreshBtn,
    ErrorDiv,
    ContractA, AA, BA, CA; // addresses

// Utility fns
// Add Xavier's helper function to wait for a transaction to be mined, to web3.eth
function AddGetTransactionReceiptMinedToWeb3() {
  web3.eth.getTransactionReceiptMined = function(txnHash, interval) {
    var transactionReceiptAsync;
    interval = interval ? interval : 500;
    transactionReceiptAsync = function(txnHash, resolve, reject) {
      try {
        var receipt = web3.eth.getTransactionReceipt(txnHash);
        if (receipt == null) {
          setTimeout(function() {
            transactionReceiptAsync(txnHash, resolve, reject);
          }, interval);
        }else{
          resolve(receipt);
        }
      } catch(e) {
        reject(e);
      }
    };

    if (Array.isArray(txnHash)) {
      var promises = [];
      txnHash.forEach(function(oneTxHash) {
        promises.push(web3.eth.getTransactionReceiptMined(oneTxHash, interval));
      });
      return Promise.all(promises);
    } else {
      return new Promise(function(resolve, reject) {
        transactionReceiptAsync(txnHash, resolve, reject);
      })
    }
  }
}

function HideErrorDiv() {
  ErrorDiv.style.display = 'none'
}

function ShowErrorDiv() {
  ErrorDiv.style.display = 'block'
}

function DisableButtons() {
  SendBtn.disabled=true;
  RefreshBtn.disabled=true;
}

function EnableButtons() {
  SendBtn.disabled=false;
  RefreshBtn.disabled=false;
}

function SetStatus(msgS) {
  document.getElementById("Status").innerHTML = msgS;
}

function SetError(msgS) {
  if (!Errors++) {
    ShowErrorDiv();
    document.getElementById("Error").innerHTML=msgS+"."
    SetStatus("Waiting on correction of error below.");
    EnableButtons();
  }
}

function LogAndSetStatus(msgS) {
  console.log(msgS);
  SetStatus(msgS);
}

function WhoFromAddr(whoA) {
  if (whoA == AA)
    return 'A';
  if (whoA == BA)
    return 'B';
  if (whoA == CA)
    return 'C';
  return whoA; // Not current A, B, or C
}

// Called if a contract or web3 error occurs
function WebAccessError(msgS, e) {
  SetError(msgS);
  console.log(msgS+" Error");
  console.error(""+e); // remove the ""+ for more details of the error
  SetStatus("See the log for more details of the error below.");
}

// Clear both before and after balance for whoS
function ClearBalances(whoS) {
  document.getElementById(whoS+"Ante").innerHTML =
  document.getElementById(whoS+"Post").innerHTML = "";
}

// Called as first thing on either a refresh or send btn click
function SetAndCheckAddresses() {
  HideErrorDiv();
  DisableButtons();
  Errors = 0;
  for (var i=0; i<3; i++) {
    var whoS = !i ? "A" : (i==1 ? "B" : "C"),
        whoA = document.getElementById(whoS+"Addr").value;
    if (!web3.isAddress(whoA)) {
      SetError("Address for "+whoS+" is invalid");
      ClearBalances(whoS);
      return false;
    }
    if (whoA == ContractA) {
      SetError("Address for "+whoS+" is the same as that of the contract. The contract cannot be either sender or recipient");
      ClearBalances(whoS);
      return false;
    }
    switch (i) {
      case 0: AA = whoA; break;
      case 1: BA = whoA; break;
      case 2: CA = whoA; break;
    }
  }
  if (BA == AA) {
    SetError("The address for B is the same as the address for A")
    ClearBalances('B');
    return false;
  }
  if (CA == AA) {
    SetError("The address for C is the same as the address for A")
    ClearBalances('C');
    return false;
  }
  if (CA == BA) {
    SetError("The address for C is the same as the address for B")
    ClearBalances('C');
    return false;
  }
  return true;
}

// Sets the Ante balance and clears the Post balance
// Is called only from RefreshBalances()
function SetAnteBalance(i) { // i = 0 to 2 for A to C
  var whoS = !i ? "A" : (i==1 ? "B" : "C"),
      whoA = document.getElementById(whoS+"Addr").value,
    anteEl = document.getElementById(whoS+"Ante");
  // clear both ante and post balances
  anteEl.innerHTML = document.getElementById(whoS+"Post").innerHTML = "";
  // console.log("whoS "+whoS+", whoA "+whoA);
  if (!web3.isAddress(whoA)) // don't expect this after the SetAndCheckAddresses() call before this
    return;
  web3.eth.getBalance(whoA, function(e, result) {
    if (e)
      WebAccessError("Getting balance for " + whoS, e);
    else{
      anteEl.innerHTML = web3.fromWei(result, "ether");
      if (i==2) // C done
        EnableButtons();
    }
  })
}

// Called during split and withdrawals ops
function SetPostBalance(whoS, whoA, doneFn) {
  web3.eth.getBalance(whoA, function(e, result) {
    if (e)
      WebAccessError("Getting balance for " + whoS, e)
    else{
      document.getElementById(whoS+"Post").innerHTML = web3.fromWei(result, "ether");
      if (doneFn) // set on last withdrawal success call for C
        doneFn();
    }
  })
}

// Button click fns
function RefreshBalances() {
  if (!SetAndCheckAddresses())
    return;
  SetStatus("Refreshing balances...");
  for (var i=0; i<=2; i++)
    SetAnteBalance(i);
  SetStatus("Balances refreshed"); // this will be overwritten if an error occurs in a SetAnteBalance() callback
}

function Send() {
  if (!SetAndCheckAddresses())
    return;
  var weiToSend = web3.toWei(document.getElementById("AAmt").value, "ether");
  // Check weiToSend against A's current balance
  web3.eth.getBalance(AA, function(e, result) {
    if (e) {
      Errors++;
      WebAccessError("Getting balance for A", e)
    }else{
      document.getElementById("AAnte").innerHTML = web3.fromWei(result, "ether"); // Set AAnte again in case A's balance has changed
      if (result.lessThan(weiToSend)) {
        SetError("Amount to be sent is greater than A's current balance");
        return;
      }
      // Ok to do the send
      var msgS = "Sending " + weiToSend + " wei to be split";
      LogAndSetStatus(msgS);
      Instance.split(BA, CA, {from: AA, value: weiToSend})
      .then(function(txHash) {
        console.log("Split Tx: " + txHash);
        return web3.eth.getTransactionReceiptMined(txHash)
      })
      .then(function() {
        // The split() trans has been mined
        console.log("Send to split() completed");
        SetPostBalance('A', AA);
        msgS = "Withdrawing for B";
        LogAndSetStatus(msgS);
        return Instance.withdraw({from: BA})
      })
      .then(txHash => {
        console.log("B withdrawal Tx: " + txHash);
        return web3.eth.getTransactionReceiptMined(txHash);
      })
      .then(function() {
        SetPostBalance('B', BA);
        msgS = "Withdrawing for C";
        LogAndSetStatus(msgS);
        return Instance.withdraw({from: CA})
      })
      .then(txHash => {
        console.log("C withdrawal Tx: " + txHash);
        return web3.eth.getTransactionReceiptMined(txHash);
      })
      .then(function() {
        SetPostBalance('C', CA, SendDone);
      }).catch(e => WebAccessError(msgS, e));
    }
  })
}

function SendDone() {
  if (!Errors)
    LogAndSetStatus("Send and withdrawals completed");
  EnableButtons();
}

// Event fns
window.onload = function() {
  AddGetTransactionReceiptMinedToWeb3();
  Instance  = PuSplitter.deployed();
  ContractA = PuSplitter.address;
  console.log("Contract address: "+ContractA);
  Instance.getVersion.call()
  .then(result => {
    document.getElementById("Version").innerHTML = result;
  }).catch(e => WebAccessError("Getting version", e));
  // Elements
  (SendBtn    = document.getElementById("SendBtn")).addEventListener("click", Send);
  (RefreshBtn = document.getElementById("RefreshBtn")).addEventListener("click", RefreshBalances);
  ErrorDiv    = document.getElementById("ErrorDiv");
  // For testing purposes fill in some addresses
  document.getElementById("AAddr").value = web3.eth.accounts[1];
  document.getElementById("BAddr").value = web3.eth.accounts[2];
  document.getElementById("CAddr").value = web3.eth.accounts[3];
  RefreshBalances();
  LogSplits();
  LogWithdrawals();
} // end onload

/* Event handlers
  event OnSplit(address SenderA, uint WeiSentU, uint WeiToBU, uint WeiToCU); // Split on send from A, half to B, other half to C
  event OnWithdrawal(address SenderA, uint WeiWithdrawnU);
*/
function LogSplits() {
  Instance.OnSplit()
    .watch(function(e, value) {
      if (e)
        console.error(e);
      else
        console.log(web3.fromWei(value.args.WeiSentU, "ether") + " ethers sent from "+WhoFromAddr(value.args.SenderA)+" split as " +
                    web3.fromWei(value.args.WeiToBU, "ether") + " ethers to B and " +
                    web3.fromWei(value.args.WeiToCU, "ether") + " ethers to C");
    });
}

function LogWithdrawals() {
  Instance.OnWithdrawal()
    .watch(function(e, value) {
      if (e)
        console.error(e);
      else
        console.log(web3.fromWei(value.args.WeiWithdrawnU, "ether") + " ethers withdrawn by " + WhoFromAddr(value.args.SenderA));
    });
}
