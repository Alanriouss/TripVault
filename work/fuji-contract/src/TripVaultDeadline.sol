// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {TripVaultFuji} from "./TripVaultFuji.sol";

contract TripVaultDeadline is TripVaultFuji {
    error FundingFailed();

    uint256 public depositDeadline;
    bool private fundingAccepted;

    constructor(address[] memory members, uint256 deadline, uint256 startsAt, uint256 endsAt, uint256 minDeposit)
        TripVaultFuji(members, startsAt, endsAt, minDeposit)
    {
        if (deadline <= block.timestamp || deadline >= startsAt || startsAt >= endsAt) revert InvalidSchedule();
        depositDeadline = deadline;
    }

    function fundingFailed() public view returns (bool) {
        if (block.timestamp < depositDeadline || fundingAccepted) return false;
        for (uint256 i; i < roster.length; ++i) {
            if (deposits[roster[i]] < minimum) return true;
        }
        return false;
    }

    function deposit(uint256 amount) public override {
        if (block.timestamp >= depositDeadline) {
            acceptFunding();
            if (block.timestamp < start) revert OutsideWindow();
        }
        super.deposit(amount);
    }

    function withdraw(uint256 amount) public override {
        if (block.timestamp >= depositDeadline) revert OutsideWindow();
        super.withdraw(amount);
    }

    function endTripEarly() public override {
        if (block.timestamp < start) revert OutsideWindow();
        acceptFunding();
        super.endTripEarly();
    }

    function claim() public override {
        if (fundingFailed()) {
            if (!member[msg.sender]) revert Unauthorized();
            uint256 amount = deposits[msg.sender];
            release(msg.sender, amount);
            emit Claimed(msg.sender, amount);
            return;
        }
        if (block.timestamp >= depositDeadline) acceptFunding();
        super.claim();
    }

    function checkSettlementWindow() internal override {
        super.checkSettlementWindow();
        acceptFunding();
    }

    // Record the successful deadline check before any later changes to balances.
    function acceptFunding() private {
        if (fundingFailed()) revert FundingFailed();
        fundingAccepted = true;
    }
}
