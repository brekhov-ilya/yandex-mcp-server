export interface TrackerUser {
  self: string;
  id: string;
  display: string;
  login?: string;
  email?: string;
}

export interface TrackerStatus {
  self: string;
  id: string;
  key: string;
  display: string;
}

export interface TrackerPriority {
  self: string;
  id: string;
  key: string;
  display: string;
}

export interface TrackerIssueType {
  self: string;
  id: string;
  key: string;
  display: string;
}

export interface TrackerQueue {
  self: string;
  id: string;
  key: string;
  display: string;
}

export interface TrackerIssue {
  self: string;
  id: string;
  key: string;
  version: number;
  summary: string;
  description?: string;
  queue: TrackerQueue;
  status: TrackerStatus;
  type: TrackerIssueType;
  priority: TrackerPriority;
  createdBy: TrackerUser;
  assignee?: TrackerUser;
  followers?: TrackerUser[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  deadline?: string;
  tags?: string[];
  components?: Array<{ self: string; id: string; display: string }>;
  sprint?: Array<{ self: string; id: string; display: string }>;
  [key: string]: unknown;
}

export interface TrackerComment {
  self: string;
  id: string;
  text: string;
  createdBy: TrackerUser;
  updatedBy?: TrackerUser;
  createdAt: string;
  updatedAt: string;
  transport?: string;
  [key: string]: unknown;
}

export interface TrackerAttachment {
  self: string;
  id: string;
  name: string;
  content: string;
  mimetype: string;
  size: number;
  createdBy: TrackerUser;
  createdAt: string;
  [key: string]: unknown;
}

export interface TrackerLinkDirection {
  self: string;
  id: string;
  key: string;
  display: string;
}

export interface TrackerLink {
  self: string;
  id: string;
  type: TrackerLinkDirection;
  direction: string;
  object: {
    self: string;
    id: string;
    key: string;
    display: string;
  };
  status: TrackerStatus;
  [key: string]: unknown;
}

export interface TrackerClientConfig {
  token: string;
  orgId?: string;
  cloudOrgId?: string;
}

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface YandexTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthConfig {
  clientId: string;
  forceAuth: boolean;
}
