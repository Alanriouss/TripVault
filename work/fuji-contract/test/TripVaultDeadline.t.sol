// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {TripVaultDeadline} from "../src/TripVaultDeadline.sol";
import {TripVaultFuji} from "../src/TripVaultFuji.sol";
import {Vm, MockUSDC} from "./TripVaultFuji.t.sol";

contract TripVaultDeadlineTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ALICE = address(0xA);
    address private constant BOB = address(0xB);
    uint256 private constant M = 1_000_000;
    uint256 private constant DEADLINE = 10_000;
    uint256 private constant START = 12_000;
    uint256 private constant END = 20_000;
    TripVaultDeadline private vault;
    MockUSDC private token;

    function setUp() public {
        vm.chainId(43113);
        vm.warp(DEADLINE - 10);
        address[] memory members = new address[](2);
        members[0] = ALICE;
        members[1] = BOB;
        vm.prank(ALICE);
        vault = new TripVaultDeadline(members, DEADLINE, START, END, 5 * M);
        token = MockUSDC(vault.USDC());
        vm.etch(address(token), address(new MockUSDC()).code);
        token.mint(ALICE, 100 * M);
        token.mint(BOB, 100 * M);
        vm.prank(ALICE);
        token.approve(address(vault), 100 * M);
        vm.prank(BOB);
        token.approve(address(vault), 100 * M);
    }

    function fundBoth() private {
        vm.prank(ALICE);
        vault.deposit(5 * M);
        vm.prank(BOB);
        vault.deposit(5 * M);
    }

    function testUnderfundedAtDeadlineIsCancelledAndRefundsImmediately() public {
        fundBoth();
        vm.prank(BOB);
        vault.withdraw(M);
        require(!vault.fundingFailed());
        vm.warp(DEADLINE);
        require(vault.fundingFailed());
        vm.expectRevert(TripVaultDeadline.FundingFailed.selector);
        vm.prank(BOB);
        vault.deposit(M);
        vm.prank(ALICE);
        vault.claim();
        vm.prank(BOB);
        vault.claim();
        require(token.balanceOf(ALICE) == 100 * M && token.balanceOf(BOB) == 100 * M);
        vm.warp(START);
        require(vault.fundingFailed());
        vm.expectRevert(TripVaultDeadline.FundingFailed.selector);
        vm.prank(ALICE);
        vault.endTripEarly();
    }

    function testFullyFundedTripLocksUntilStartAndCanSettle() public {
        fundBoth();
        vm.warp(DEADLINE);
        require(!vault.fundingFailed());
        vm.expectRevert(TripVaultFuji.OutsideWindow.selector);
        vm.prank(BOB);
        vault.withdraw(M);
        vm.expectRevert(TripVaultFuji.OutsideWindow.selector);
        vm.prank(BOB);
        vault.deposit(M);
        vm.warp(START);
        vm.prank(BOB);
        vault.deposit(M);
        vm.warp(END);
        int256[] memory amounts = new int256[](2);
        amounts[0] = int256(M);
        amounts[1] = -int256(M);
        vm.prank(ALICE);
        vault.propose(amounts);
        (,,,,bytes32 hash,,,,) = vault.snapshot();
        vm.prank(BOB);
        vault.approve(hash, true);
        vm.prank(ALICE);
        vault.settle(hash);
        vm.prank(ALICE);
        vault.claim();
        vm.prank(BOB);
        vault.claim();
        require(!vault.fundingFailed());
        require(token.balanceOf(ALICE) == 101 * M && token.balanceOf(BOB) == 99 * M);
    }

    function testExpiredFullyFundedTripDoesNotBecomeCancelledWhenClaimed() public {
        fundBoth();
        vm.warp(END + 7 days);
        vm.prank(ALICE);
        vault.claim();
        require(!vault.fundingFailed());
        vm.prank(BOB);
        vault.claim();
        require(!vault.fundingFailed());
        require(token.balanceOf(address(vault)) == 0);
    }
}
