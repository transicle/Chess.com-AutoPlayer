export interface PlayerInfo {
  username: string;
  avatar: string;
  rating: string;
  clock: string;
  panel?: string;
}

export interface PlayerData {
  top: PlayerInfo;
  bottom: PlayerInfo;
}

export interface BoardRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BoardInfo {
  rect: BoardRect;
  flipped: boolean;
}

export interface MoveListResult {
  count: number;
  moves: string[];
  nodeCount: number;
}
