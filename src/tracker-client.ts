import type {
  TrackerClientConfig,
  TrackerIssue,
  TrackerComment,
  TrackerAttachment,
  TrackerLink,
  TrackerStatus,
  TrackerIssueType,
  TrackerResolution,
  TrackerPriority,
  TrackerQueueFull,
  TrackerField,
  TrackerEntity,
  TrackerChecklistItem,
  TrackerTransition,
  CreateIssueParams,
  UpdateIssueParams,
} from "./types.js";

const BASE_URL = "https://api.tracker.yandex.net";

export class TrackerClient {
  private readonly token: string;
  private readonly orgHeader: Record<string, string>;

  constructor(config: TrackerClientConfig) {
    this.token = config.token;

    if (config.orgId) {
      this.orgHeader = { "X-Org-ID": config.orgId };
    } else if (config.cloudOrgId) {
      this.orgHeader = { "X-Cloud-Org-ID": config.cloudOrgId };
    } else {
      throw new Error("Either orgId or cloudOrgId must be provided");
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${BASE_URL}${path}`;

    const headers: Record<string, string> = {
      Authorization: `OAuth ${this.token}`,
      ...this.orgHeader,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Tracker API error ${response.status}: ${errorBody}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async getIssue(issueKey: string): Promise<TrackerIssue> {
    return this.request<TrackerIssue>(
      "GET",
      `/v2/issues/${encodeURIComponent(issueKey)}`,
    );
  }

  async searchIssues(
    query: string,
    page: number = 1,
    perPage: number = 50,
  ): Promise<TrackerIssue[]> {
    return this.request<TrackerIssue[]>(
      "POST",
      `/v2/issues/_search?page=${page}&perPage=${perPage}`,
      { query },
    );
  }

  async getComments(issueKey: string): Promise<TrackerComment[]> {
    return this.request<TrackerComment[]>(
      "GET",
      `/v2/issues/${encodeURIComponent(issueKey)}/comments`,
    );
  }

  async getAttachments(issueKey: string): Promise<TrackerAttachment[]> {
    return this.request<TrackerAttachment[]>(
      "GET",
      `/v2/issues/${encodeURIComponent(issueKey)}/attachments`,
    );
  }

  async downloadAttachment(
    issueKey: string,
    attachmentId: string,
  ): Promise<{ content: string; mimeType: string }> {
    const attachments = await this.getAttachments(issueKey);
    const attachment = attachments.find((a) => a.id === attachmentId);

    if (!attachment) {
      throw new Error(
        `Attachment ${attachmentId} not found in issue ${issueKey}`,
      );
    }

    const url = attachment.content;

    const response = await fetch(url, {
      headers: {
        Authorization: `OAuth ${this.token}`,
        ...this.orgHeader,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Tracker API error ${response.status}: ${errorBody}`,
      );
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      content: base64,
      mimeType: attachment.mimetype,
    };
  }

  async getIssueLinks(issueKey: string): Promise<TrackerLink[]> {
    return this.request<TrackerLink[]>(
      "GET",
      `/v2/issues/${encodeURIComponent(issueKey)}/links`,
    );
  }

  async createIssue(params: CreateIssueParams): Promise<TrackerIssue> {
    return this.request<TrackerIssue>("POST", "/v2/issues", params);
  }

  async updateIssue(
    issueKey: string,
    params: UpdateIssueParams,
  ): Promise<TrackerIssue> {
    return this.request<TrackerIssue>(
      "PATCH",
      `/v2/issues/${encodeURIComponent(issueKey)}`,
      params,
    );
  }

  async getStatuses(): Promise<TrackerStatus[]> {
    return this.request<TrackerStatus[]>("GET", "/v2/statuses");
  }

  async getIssueTypes(): Promise<TrackerIssueType[]> {
    return this.request<TrackerIssueType[]>("GET", "/v2/issuetypes");
  }

  async getResolutions(): Promise<TrackerResolution[]> {
    return this.request<TrackerResolution[]>("GET", "/v2/resolutions");
  }

  async getPriorities(): Promise<TrackerPriority[]> {
    return this.request<TrackerPriority[]>("GET", "/v2/priorities");
  }

  async getQueues(page: number = 1, perPage: number = 50): Promise<TrackerQueueFull[]> {
    return this.request<TrackerQueueFull[]>(
      "GET",
      `/v2/queues?page=${page}&perPage=${perPage}`,
    );
  }

  async getEntity(
    entityType: string,
    entityId: string,
  ): Promise<TrackerEntity> {
    return this.request<TrackerEntity>(
      "GET",
      `/v2/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}?fields=summary,description,author,lead,teamUsers,start,end,status`,
    );
  }

  async getQueueLocalFields(queueKey: string): Promise<TrackerField[]> {
    return this.request<TrackerField[]>(
      "GET",
      `/v2/queues/${encodeURIComponent(queueKey)}/localFields`,
    );
  }

  async getGlobalFields(): Promise<TrackerField[]> {
    return this.request<TrackerField[]>("GET", "/v2/fields");
  }

  async getTransitions(issueKey: string): Promise<TrackerTransition[]> {
    return this.request<TrackerTransition[]>(
      "GET",
      `/v2/issues/${encodeURIComponent(issueKey)}/transitions`,
    );
  }

  async executeTransition(
    issueKey: string,
    transitionId: string,
    fields?: Record<string, unknown>,
  ): Promise<TrackerTransition[]> {
    return this.request<TrackerTransition[]>(
      "POST",
      `/v2/issues/${encodeURIComponent(issueKey)}/transitions/${encodeURIComponent(transitionId)}/_execute`,
      fields,
    );
  }

  async getChecklist(issueKey: string): Promise<TrackerChecklistItem[]> {
    return this.request<TrackerChecklistItem[]>(
      "GET",
      `/v2/issues/${encodeURIComponent(issueKey)}/checklistItems`,
    );
  }
}
