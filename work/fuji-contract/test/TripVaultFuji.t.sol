// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../src/TripVaultFuji.sol";

interface Vm {
    function chainId(uint256 value) external;
    function etch(address account, bytes calldata code) external;
    function warp(uint256 timestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata data) external;
}

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract TripVaultFujiTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ALICE = address(0xA);
    address private constant BOB = address(0xB);
    address private constant CAROL = address(0xC);
    uint256 private constant START = 10_000;
    uint256 private constant END = 20_000;
    uint256 private constant M = 1_000_000;
    TripVaultFuji private vault;
    MockUSDC private token;

    function setUp() public {
        vm.chainId(43113);
        vm.warp(9_000);
        vm.prank(ALICE);
        vault = new TripVaultFuji(members(), START, END, 5 * M);
        token = MockUSDC(vault.USDC());
        vm.etch(address(token), address(new MockUSDC()).code);
        token.mint(ALICE, 100 * M);
        token.mint(BOB, 100 * M);
        token.mint(CAROL, 100 * M);
    }

    function members() private pure returns (address[] memory value) {
        value = new address[](3);
        value[0] = ALICE;
        value[1] = BOB;
        value[2] = CAROL;
    }

    function deposit(address from, uint256 amount) private {
        vm.prank(from);
        token.approve(address(vault), amount);
        vm.prank(from);
        vault.deposit(amount);
    }

    function propose() private returns (bytes32 hash) {
        int256[] memory net = new int256[](3);
        net[0] = 4_000_000;
        net[1] = -8_000_000;
        net[2] = 4_000_000;
        vm.prank(ALICE);
        vault.propose(net);
        (,,,,hash,,,,) = vault.snapshot();
    }

    function approve(address from, bytes32 hash) private {
        vm.prank(from);
        vault.approve(hash, true);
    }

    function testDepositTopUpSettleAndClaim() public {
        deposit(ALICE, 5 * M);
        deposit(BOB, 5 * M);
        deposit(CAROL, 5 * M);
        vm.warp(END);
        bytes32 hash = propose();
        approve(BOB, hash);
        approve(CAROL, hash);

        vm.expectRevert(abi.encodeWithSelector(TripVaultFuji.Underfunded.selector, BOB, 8 * M, 5 * M));
        vm.prank(ALICE);
        vault.settle(hash);

        vm.prank(BOB);
        token.approve(address(vault), 3 * M);
        vm.expectRevert(TripVaultFuji.InvalidAmount.selector);
        vm.prank(BOB);
        vault.depositForPlan(2 * M, hash);
        vm.prank(BOB);
        vault.depositForPlan(3 * M, hash);

        vm.prank(ALICE);
        vault.settle(hash);
        (, uint256[] memory balances,,,,,,, bool closed) = vault.snapshot();
        require(closed && balances[0] == 9 * M && balances[1] == 0 && balances[2] == 9 * M);
        require(token.balanceOf(address(vault)) == 18 * M);
        vm.expectRevert(TripVaultFuji.OutsideWindow.selector);
        vm.prank(ALICE);
        vault.settle(hash);
        vm.prank(ALICE);
        vault.claim();
        vm.prank(CAROL);
        vault.claim();
        require(token.balanceOf(address(vault)) == 0);
        uint256[] memory payouts = vault.payoutSnapshot();
        require(payouts[0] == 9 * M && payouts[1] == 0 && payouts[2] == 9 * M);
        require(token.balanceOf(ALICE) == 104 * M && token.balanceOf(BOB) == 92 * M && token.balanceOf(CAROL) == 104 * M);
    }

    function testReplacementInvalidatesApprovalsAndExactTopUp() public {
        deposit(ALICE, 5 * M);
        deposit(BOB, 5 * M);
        deposit(CAROL, 5 * M);
        vm.warp(END);
        bytes32 old = propose();
        approve(BOB, old);
        approve(CAROL, old);
        bytes32 fresh = propose();
        require(old != fresh);
        vm.expectRevert(TripVaultFuji.InvalidPlan.selector);
        vm.prank(BOB);
        vault.depositForPlan(3 * M, old);
        vm.expectRevert(abi.encodeWithSelector(TripVaultFuji.MissingApproval.selector, BOB));
        vm.prank(ALICE);
        vault.settle(fresh);
    }

    function testEarlyWithdrawAndExpiredRefund() public {
        deposit(BOB, 5 * M);
        vm.prank(BOB);
        vault.withdraw(M);
        vm.warp(START);
        vm.expectRevert(TripVaultFuji.OutsideWindow.selector);
        vm.prank(BOB);
        vault.withdraw(M);
        vm.expectRevert(TripVaultFuji.OutsideWindow.selector);
        vm.prank(BOB);
        vault.claim();
        vm.warp(END + 7 days);
        vm.prank(BOB);
        vault.claim();
        require(token.balanceOf(BOB) == 100 * M && token.balanceOf(address(vault)) == 0);
    }


    function testOrganizerEndsEarlyAndCanPublish() public {
        vm.warp(START + 1);
        vm.expectRevert(TripVaultFuji.Unauthorized.selector);
        vm.prank(BOB);
        vault.endTripEarly();
        vm.prank(ALICE);
        vault.endTripEarly();
        (,,,,,,uint256 end,,) = vault.snapshot();
        require(end == START + 1);
        require(vault.refundDeadline() == end + 7 days);
        require(propose() != bytes32(0));
        vm.expectRevert(TripVaultFuji.OutsideWindow.selector);
        vm.prank(ALICE);
        vault.endTripEarly();
    }

    function testCanDeployAndFundAfterScheduledEnd() public {
        uint256 deployedAt = END + 30 days;
        vm.warp(deployedAt);
        vm.prank(ALICE);
        vault = new TripVaultFuji(members(), START, END, 5 * M);
        require(vault.refundDeadline() == deployedAt + 7 days);
        deposit(ALICE, 5 * M);
        deposit(BOB, 8 * M);
        deposit(CAROL, 5 * M);
        bytes32 plan = propose();
        approve(BOB, plan);
        approve(CAROL, plan);
        vm.prank(ALICE);
        vault.settle(plan);
        require(vault.payoutSnapshot()[0] == 9 * M);
    }

    function testRejectsMainnetAndOutsider() public {
        vm.expectRevert(TripVaultFuji.Unauthorized.selector);
        vault.deposit(M);
        vm.chainId(43114);
        vm.expectRevert(TripVaultFuji.FujiOnly.selector);
        vm.prank(ALICE);
        new TripVaultFuji(members(), START, END, 5 * M);
    }
}
