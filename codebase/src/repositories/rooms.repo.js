import { createRepository } from "./base.repo.js";

const rooms = createRepository("rooms", "room");
const messages = createRepository("roomMessages", "msg");

const byOldest = (a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || ""));

export const roomsRepo = {
  list() {
    return rooms.all();
  },

  findById(id) {
    return rooms.findById(id);
  },

  listMessages(roomId) {
    return messages.filter((message) => message.roomId === roomId).sort(byOldest);
  },

  countMessages(roomId) {
    return messages.filter((message) => message.roomId === roomId).length;
  },

  lastMessage(roomId) {
    const list = this.listMessages(roomId);
    return list.length ? list[list.length - 1] : null;
  },

  addMessage(data) {
    return messages.insert(data);
  },
};
