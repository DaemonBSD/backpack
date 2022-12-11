import { ethers } from "ethers";
import express from "express";

import { clearCookie, setCookie } from "../../auth/util";
import { getUser } from "../../db/users";
import {
  validateEthereumSignature,
  validateSolanaSignature,
} from "../../validation/user";

const { base58 } = ethers.utils;

const router = express.Router();

router.delete("/", async (req, res) => {
  clearCookie(res, "jwt");
  return res.json({ msg: "ok" });
});

router.post("/", async (req, res) => {
  const { blockchain, signature, publicKey, message } = req.body;
  const decodedMessage = Buffer.from(base58.decode(message));

  const messagePrefix = "Backpack login ";
  if (!decodedMessage.toString().startsWith(messagePrefix)) {
    return res.status(403).json({ msg: "invalid signed message" });
  }

  const uuid = decodedMessage.toString().replace(messagePrefix, "");

  let valid = false;
  if (blockchain === "solana") {
    valid = validateSolanaSignature(
      decodedMessage,
      base58.decode(signature),
      base58.decode(publicKey)
    );
  } else if (blockchain === "ethereum") {
    valid = validateEthereumSignature(decodedMessage, signature, publicKey);
  }
  if (!valid) {
    return res.status(403).json({ msg: "invalid signature" });
  }

  let user;
  try {
    user = await getUser(uuid);
    // Make sure the user has the signing public key
    const hasPublicKey = user.publicKeys.find(
      ({ blockchain: b, publicKey: p }) => b === blockchain && p === publicKey
    );
    if (!hasPublicKey)
      return res
        .status(403)
        .json({ msg: "invalid signing public key for user" });
  } catch {
    // User not found
    return res.status(403).json({ msg: "invalid user id" });
  }

  const jwt = await setCookie(req, res, user.id as string);

  return res.json({ ...user, jwt });
});

export default router;