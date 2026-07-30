import { badRequest, notFound } from "../lib/errors.js";
import { roomsRepo } from "../repositories/rooms.repo.js";

const MAX_MESSAGE_LENGTH = 1000;

export function listRooms() {
  return roomsRepo.list().map((room) => ({
    ...room,
    messageCount: roomsRepo.countMessages(room.id),
    lastMessage: roomsRepo.lastMessage(room.id),
  }));
}

function requireRoom(roomId) {
  const room = roomsRepo.findById(roomId);
  if (!room) throw notFound("Không tìm thấy phòng chat.", "ROOM_NOT_FOUND");
  return room;
}

export function listMessages(roomId) {
  requireRoom(roomId);
  return roomsRepo.listMessages(roomId);
}

export async function postMessage({ roomId, content, user }) {
  requireRoom(roomId);
  const text = String(content || "").trim();
  if (!text) throw badRequest("Nội dung tin nhắn không được để trống.", "EMPTY_MESSAGE");
  if (text.length > MAX_MESSAGE_LENGTH) throw badRequest(`Tin nhắn tối đa ${MAX_MESSAGE_LENGTH} ký tự.`, "MESSAGE_TOO_LONG");

  return roomsRepo.addMessage({
    roomId,
    content: text,
    userId: user.id,
    userName: user.displayName,
  });
}
