import { generateStreamToken } from "../lib/stream.js";
import User from "../models/User.js";
import crypto from "crypto";

// In-memory store for active calls (callId -> call session data)
// In production, use Redis or a database for this
const activeCalls = new Map();

// Clean up expired calls every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [callId, callData] of activeCalls.entries()) {
    if (now > callData.expiresAt) {
      activeCalls.delete(callId);
    }
  }
}, 60 * 1000);

export async function getStreamToken(req, res) {
  try {
    const token = generateStreamToken(req.user.id);

    res.status(200).json({ token });
  } catch (error) {
    console.log("Error in getStreamToken controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function createCall(req, res) {
  try {
    const callerId = req.user.id;
    const { friendId } = req.params;

    // Verify the friend exists
    const friend = await User.findById(friendId);
    if (!friend) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify they are actually friends
    const caller = await User.findById(callerId);
    const areFriends = caller.friends.some(
      (fId) => fId.toString() === friendId
    );

    if (!areFriends) {
      return res
        .status(403)
        .json({ message: "You can only call your friends" });
    }

    // Generate a unique call ID
    const callId = crypto.randomUUID();

    // Store the call session with 5-minute expiry
    activeCalls.set(callId, {
      callerId: callerId.toString(),
      friendId: friendId.toString(),
      participants: [callerId.toString(), friendId.toString()],
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    res.status(201).json({ callId });
  } catch (error) {
    console.error("Error in createCall controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function validateCall(req, res) {
  try {
    const userId = req.user.id.toString();
    const { callId } = req.params;

    const callData = activeCalls.get(callId);

    // Check if call exists
    if (!callData) {
      return res
        .status(404)
        .json({ message: "Call not found or has expired" });
    }

    // Check if call has expired
    if (Date.now() > callData.expiresAt) {
      activeCalls.delete(callId);
      return res.status(410).json({ message: "This call has expired" });
    }

    // Check if the user is an authorized participant
    if (!callData.participants.includes(userId)) {
      return res
        .status(403)
        .json({ message: "You are not authorized to join this call" });
    }

    res.status(200).json({
      callId,
      participants: callData.participants,
      expiresAt: callData.expiresAt,
    });
  } catch (error) {
    console.error("Error in validateCall controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}