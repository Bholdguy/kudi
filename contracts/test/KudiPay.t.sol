// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {KudiPay} from "../KudiPay.sol";

interface Vm {
    function deal(address account, uint256 newBalance) external;
    function prank(address sender) external;
    function expectRevert(bytes calldata revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData) external;
}

contract Receiver {
    receive() external payable {}
}

contract RejectingReceiver {
    receive() external payable {
        revert("no");
    }
}

/// @dev Tries to pay the same invoice again from inside its own receive().
contract ReentrantReceiver {
    KudiPay public immutable kudi;
    bytes32 public salt;

    constructor(KudiPay _kudi) {
        kudi = _kudi;
    }

    function arm(bytes32 _salt) external {
        salt = _salt;
    }

    receive() external payable {
        kudi.pay{value: msg.value}(payable(address(this)), salt);
    }
}

contract KudiPayTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    KudiPay internal kudi;
    Receiver internal freelancer;
    address internal payer = address(0xA11CE);
    bytes32 internal constant SALT = keccak256("inv_abc123");
    uint256 internal constant AMOUNT = 25e18;

    function setUp() public {
        kudi = new KudiPay();
        freelancer = new Receiver();
        vm.deal(payer, 1_000e18);
    }

    function pay(address to, uint256 amount, bytes32 salt) internal {
        vm.prank(payer);
        kudi.pay{value: amount}(payable(to), salt);
    }

    function testHappyPathForwardsFundsAndMarksPaid() public {
        bytes32 id = kudi.invoiceIdOf(address(freelancer), AMOUNT, SALT);
        uint256 before = address(freelancer).balance;

        vm.expectEmit(true, true, true, true);
        emit KudiPay.InvoicePaid(id, payer, address(freelancer), AMOUNT);
        pay(address(freelancer), AMOUNT, SALT);

        require(address(freelancer).balance == before + AMOUNT, "freelancer not paid in full");
        require(address(kudi).balance == 0, "contract must hold no funds");
        require(kudi.paid(id), "invoice not marked paid");
    }

    function testRevertsOnZeroAmount() public {
        vm.expectRevert(abi.encodeWithSelector(KudiPay.ZeroAmount.selector));
        pay(address(freelancer), 0, SALT);
    }

    function testRevertsOnZeroAddress() public {
        vm.expectRevert(abi.encodeWithSelector(KudiPay.ZeroAddress.selector));
        pay(address(0), AMOUNT, SALT);
    }

    function testRevertsOnDuplicatePayment() public {
        pay(address(freelancer), AMOUNT, SALT);

        vm.expectRevert(abi.encodeWithSelector(KudiPay.AlreadyPaid.selector));
        pay(address(freelancer), AMOUNT, SALT);
    }

    function testDuplicateIsBlockedForAnyPayer() public {
        pay(address(freelancer), AMOUNT, SALT);

        // The invoice ID does not include the payer, so a second payer cannot pay it again.
        vm.deal(address(0xB0B), AMOUNT);
        vm.prank(address(0xB0B));
        vm.expectRevert(abi.encodeWithSelector(KudiPay.AlreadyPaid.selector));
        kudi.pay{value: AMOUNT}(payable(address(freelancer)), SALT);
    }

    function testWrongAmountDoesNotMarkInvoicePaid() public {
        uint256 underpaid = AMOUNT - 1;
        pay(address(freelancer), underpaid, SALT);

        bytes32 expectedId = kudi.invoiceIdOf(address(freelancer), AMOUNT, SALT);
        require(!kudi.paid(expectedId), "a different amount must not mark the invoice paid");
        require(kudi.paid(kudi.invoiceIdOf(address(freelancer), underpaid, SALT)), "paid amount not recorded");
    }

    function testSameSaltDifferentFreelancerIsADifferentInvoice() public {
        Receiver other = new Receiver();
        pay(address(freelancer), AMOUNT, SALT);
        pay(address(other), AMOUNT, SALT);

        require(kudi.paid(kudi.invoiceIdOf(address(other), AMOUNT, SALT)), "second freelancer not paid");
    }

    function testRevertsWhenFreelancerRejectsFunds() public {
        RejectingReceiver rejecting = new RejectingReceiver();

        vm.expectRevert(abi.encodeWithSelector(KudiPay.TransferFailed.selector));
        pay(address(rejecting), AMOUNT, SALT);
    }

    function testReentrantPaymentIsBlocked() public {
        ReentrantReceiver attacker = new ReentrantReceiver(kudi);
        attacker.arm(SALT);

        // The inner pay() hits AlreadyPaid, so the outer transfer fails and nothing is kept.
        vm.expectRevert(abi.encodeWithSelector(KudiPay.TransferFailed.selector));
        pay(address(attacker), AMOUNT, SALT);
    }
}
