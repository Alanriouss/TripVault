// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IFujiUSDC {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice A testnet-only escrow for a single trip. VND bills stay off-chain.
contract TripVaultFuji {
    error FujiOnly();
    error InvalidRoster();
    error InvalidSchedule();
    error Unauthorized();
    error InvalidAmount();
    error OutsideWindow();
    error InvalidPlan();
    error MissingApproval(address member);
    error Underfunded(address member, uint256 required, uint256 deposited);
    error TransferFailed();

    address public constant USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;
    uint256 public constant REFUND_DELAY = 7 days;
    uint256 private constant MAX_UNITS = 9_007_199_254_740_991;

    address private organizer;
    address[] private roster;
    mapping(address => bool) private member;
    mapping(address => uint256) private deposits;
    mapping(address => bytes32) private approval;
    uint256 private totalDeposits;
    uint256 private start;
    uint256 private end;
    uint256 private minimum;
    uint256 private revision;
    bytes32 private planHash;
    int256[] private plan;
    bool private settled;

    event Deposited(address indexed member, uint256 amount);
    event Withdrawn(address indexed member, uint256 amount);
    event SplitProposed(bytes32 indexed hash, uint256 revision);
    event SplitApproval(bytes32 indexed hash, address indexed member, bool approved);
    event Settled(bytes32 indexed hash);
    event Claimed(address indexed member, uint256 amount);

    constructor(address[] memory members, uint256 startsAt, uint256 endsAt, uint256 minDeposit) {
        if (block.chainid != 43113) revert FujiOnly();
        if (members.length == 0 || members.length > 12 || members[0] != msg.sender) revert InvalidRoster();
        if (startsAt >= endsAt || endsAt <= block.timestamp || endsAt > type(uint64).max) revert InvalidSchedule();
        if (minDeposit == 0 || minDeposit > MAX_UNITS) revert InvalidAmount();

        organizer = msg.sender;
        start = startsAt;
        end = endsAt;
        minimum = minDeposit;
        for (uint256 i; i < members.length; ++i) {
            address account = members[i];
            if (account == address(0) || member[account]) revert InvalidRoster();
            member[account] = true;
            roster.push(account);
        }
    }

    function deposit(uint256 amount) public {
        if (!member[msg.sender]) revert Unauthorized();
        if (settled || block.timestamp >= end + REFUND_DELAY) revert OutsideWindow();
        if (amount == 0 || amount > MAX_UNITS - totalDeposits) revert InvalidAmount();

        deposits[msg.sender] += amount;
        totalDeposits += amount;
        if (!IFujiUSDC(USDC).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit Deposited(msg.sender, amount);
    }

    function depositForPlan(uint256 amount, bytes32 expectedPlan) external {
        if (!member[msg.sender]) revert Unauthorized();
        checkSettlementWindow();
        if (expectedPlan == bytes32(0) || expectedPlan != planHash) revert InvalidPlan();

        for (uint256 i; i < roster.length; ++i) {
            if (roster[i] != msg.sender) continue;
            uint256 due = plan[i] < 0 ? uint256(-plan[i]) : 0;
            uint256 required = minimum > due ? minimum : due;
            uint256 current = deposits[msg.sender];
            if (current >= required || amount != required - current) revert InvalidAmount();
            break;
        }
        deposit(amount);
    }

    function withdraw(uint256 amount) external {
        if (!member[msg.sender]) revert Unauthorized();
        if (block.timestamp >= start) revert OutsideWindow();
        release(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @param changes Each member's signed USDC amount, in roster order. Debts are negative.
    function propose(int256[] calldata changes) external {
        if (msg.sender != organizer) revert Unauthorized();
        checkSettlementWindow();
        if (changes.length != roster.length) revert InvalidPlan();

        int256 net;
        for (uint256 i; i < changes.length; ++i) {
            if (changes[i] < -int256(MAX_UNITS) || changes[i] > int256(MAX_UNITS)) revert InvalidPlan();
            net += changes[i];
        }
        if (net != 0) revert InvalidPlan();

        ++revision;
        plan = changes;
        planHash = keccak256(abi.encode(address(this), revision, changes));
        approval[msg.sender] = planHash;
        emit SplitProposed(planHash, revision);
        emit SplitApproval(planHash, msg.sender, true);
    }

    function approve(bytes32 expectedPlan, bool approved) external {
        if (!member[msg.sender]) revert Unauthorized();
        checkSettlementWindow();
        if (expectedPlan == bytes32(0) || expectedPlan != planHash) revert InvalidPlan();
        approval[msg.sender] = approved ? expectedPlan : bytes32(0);
        emit SplitApproval(expectedPlan, msg.sender, approved);
    }

    function settle(bytes32 expectedPlan) external {
        if (msg.sender != organizer) revert Unauthorized();
        checkSettlementWindow();
        if (expectedPlan == bytes32(0) || expectedPlan != planHash) revert InvalidPlan();

        for (uint256 i; i < roster.length; ++i) {
            address account = roster[i];
            if (approval[account] != expectedPlan) revert MissingApproval(account);
            uint256 deposited = deposits[account];
            uint256 due = plan[i] < 0 ? uint256(-plan[i]) : 0;
            uint256 required = minimum > due ? minimum : due;
            if (deposited < required) revert Underfunded(account, required, deposited);
            deposits[account] = uint256(int256(deposited) + plan[i]);
        }
        settled = true;
        emit Settled(expectedPlan);
    }

    function claim() external {
        if (!member[msg.sender]) revert Unauthorized();
        if (!settled && block.timestamp < end + REFUND_DELAY) revert OutsideWindow();
        uint256 amount = deposits[msg.sender];
        release(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    function snapshot() external view returns (
        address[] memory members, uint256[] memory balances, int256[] memory changes, bool[] memory approvals,
        bytes32 hash, uint256 startsAt, uint256 endsAt, uint256 minDeposit, bool closed
    ) {
        members = roster;
        balances = new uint256[](roster.length);
        approvals = new bool[](roster.length);
        for (uint256 i; i < roster.length; ++i) {
            balances[i] = deposits[roster[i]];
            approvals[i] = planHash != bytes32(0) && approval[roster[i]] == planHash;
        }
        return (members, balances, plan, approvals, planHash, start, end, minimum, settled);
    }

    function checkSettlementWindow() private view {
        if (settled || block.timestamp < end || block.timestamp >= end + REFUND_DELAY) revert OutsideWindow();
    }

    function release(address account, uint256 amount) private {
        if (amount == 0 || amount > deposits[account]) revert InvalidAmount();
        deposits[account] -= amount;
        totalDeposits -= amount;
        if (!IFujiUSDC(USDC).transfer(account, amount)) revert TransferFailed();
    }
}
