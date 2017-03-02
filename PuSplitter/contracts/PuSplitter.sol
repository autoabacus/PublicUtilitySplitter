pragma solidity ^0.4.8;

/* B9Lab Public Utility Splitter Assignment

2017.03.02 0.0.1

*/
contract PuSplitter {
  string  constant cVERSION = "0.0.1";
  bool    private psPausedB;
  address private psOwnerA; // Contract owner
  mapping (address => uint) private psPendingWithdrawalsMU;

  // constructor NOT payable
  function PuSplitter() {
    psOwnerA = msg.sender;
  }

  // modifier functions
  modifier isActive() {
    if (psPausedB) throw;
    _;
  }

  // events
  event OnSplit(address SenderA, uint WeiSentU, uint WeiToBU, uint WeiToCU); // Split on send from A, half to B, other half to C
  event OnWithdrawal(address SenderA, uint WeiWithdrawnU);

  // no external functions

  // constant public functions
  function getVersion() constant returns (string VersionS) {
    return cVERSION;
  }

  function getState() constant returns (bool) {
    return psPausedB;
  }

  // public functions

  // fallback function
  function() {
    throw; // reject any attempt to send to the contract other than via split()
  }

  // Function to perform split of amount sent from A (msg.value from msg.sender) to B and C 50/50
  // No return as there is no intention to ever call this fn via .call() to test for whether a split will be performed or not, as the UI can do that.
  function split(address vBA, address vCA) payable isActive {
    // Checks. The UI should prevent a call in all of these cases, but still need the checks here in case of calls by others
    if (msg.value == 0       // Nothing sent
     || msg.sender == address(this) // A == contract
     || vBA == address(this) // B == contract
     || vCA == address(this) // C == contract
     || vBA == address(0)    // B address not set
     || vCA == address(0)    // C address not set
     || vBA == msg.sender    // B == A (sender)
     || vCA == msg.sender    // C == A (sender)
     || vCA == vBA) throw;   // C == B
    // Ethers were sent so split to B and C to be held pending withdrawal
    uint kHalf1U = msg.value/2;
    uint kHalf2U = msg.value - kHalf1U; // Not also msg.value/2 in case of odd numbered wei
    psPendingWithdrawalsMU[vBA] += kHalf1U; // half to B
    psPendingWithdrawalsMU[vCA] += kHalf2U; // the other half to C
    OnSplit(msg.sender, msg.value, kHalf1U, kHalf2U);
  }

  // Function to withdraw pending balance held
  function withdraw() isActive returns (bool) {
    uint kWeiToWithdrawU = psPendingWithdrawalsMU[msg.sender];
    if (kWeiToWithdrawU > 0) {
      // There is a balance available for withdrawal
      // Zero the pending refund before sending to prevent re-entrancy attacks
      psPendingWithdrawalsMU[msg.sender] = 0;
      if (msg.sender.send(kWeiToWithdrawU)) {
        OnWithdrawal(msg.sender, kWeiToWithdrawU);
        return true;
      }
      // the send failed
      psPendingWithdrawalsMU[msg.sender] = kWeiToWithdrawU;
    }
    return false; // either there was nothing to withdraw or the send failed
  }

  // Pause function
  // Do by setting state to Paused that is then checked on public fn calls
  function pause() {
    if (msg.sender == psOwnerA)
      psPausedB = true; // contract has been paused
    else
      throw; // Punish with throw any non-owner who dared to call this function.
  }

  // Resume function
  function resume() {
    if (msg.sender == psOwnerA)
      psPausedB = false; // contract has been resumed
    else
      throw; // Punish with throw any non-owner who dared to call this function.
  }
  // no internal functions
  // no private functions

}
