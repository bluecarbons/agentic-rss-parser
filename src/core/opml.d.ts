export interface OpmlOutlineFeed {
  title: string;
  xmlUrl: string;
  htmlUrl?: string;
  text?: string;
  category?: string;
}

export interface OpmlResult {
  title: string;
  feeds: OpmlOutlineFeed[];
}

export function parseOpml(xml: string): OpmlResult;
