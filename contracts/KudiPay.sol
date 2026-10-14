// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title KudiPay
/// @notice One transaction pays a Kudi invoice in native USDC on Arc.
/// @dev No owner, no admin, holds no funds. Each payment is forwarded to the
/// freelancer inside the same call and logged as InvoicePaid.
contract KudiPay {
    /// @notice True once a payment with this invoice ID has been forwarded.
    mapping(bytes32 => bool) public paid;

    event InvoicePaid(
        bytes32 indexed invoiceId,
        address indexed payer,
        address indexed freelancer,
        uint256 amount
    );

    error ZeroAmount();
    error ZeroAddress();
    error AlreadyPaid();
    error TransferFailed();

    /// @notice The invoice ID for a freelancer, an exact amount and a salt.
    /// @dev The amount is part of the ID, so a payment of the wrong amount
    /// never marks an invoice as paid.
    function invoiceIdOf(address freelancer, uint256 amount, bytes32 salt)
        public pure returns (bytes32)
    {
        return keccak256(abi.encode(freelancer, amount, salt));
    }

    /// @notice Pay `msg.value` to `freelancer` for the invoice identified by `salt`.
    function pay(address payable freelancer, bytes32 salt) external payable {
        if (msg.value == 0) revert ZeroAmount();
        if (freelancer == address(0)) revert ZeroAddress();
        bytes32 id = invoiceIdOf(freelancer, msg.value, salt);
        if (paid[id]) revert AlreadyPaid();
        // State flips before the external call, so a reentrant call cannot pay twice.
        paid[id] = true;
        (bool ok, ) = freelancer.call{value: msg.value}("");
        if (!ok) revert TransferFailed();
        emit InvoicePaid(id, msg.sender, freelancer, msg.value);
    }
}
