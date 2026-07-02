type SiteAnnouncementProps = {
  id: string;
  key: string;
  title: string;
  icon: string;
  iconClassName: string;
  process: string;
  status: string;
  command: string;
  output: string;
  sortOrder: number;
  updatedAt: Date;
};

class SiteAnnouncement {
  private constructor(private readonly props: SiteAnnouncementProps) {}

  static create(props: SiteAnnouncementProps) {
    return new SiteAnnouncement({
      ...props,
      id: requireText(props.id, "Site announcement id"),
      key: requireText(props.key, "Site announcement key"),
      title: requireText(props.title, "Site announcement title"),
      icon: requireText(props.icon, "Site announcement icon"),
      iconClassName: props.iconClassName.trim(),
      process: requireText(props.process, "Site announcement process"),
      status: requireText(props.status, "Site announcement status"),
      command: requireText(props.command, "Site announcement command"),
      output: requireText(props.output, "Site announcement output"),
      updatedAt: new Date(props.updatedAt.getTime()),
    });
  }

  get id() {
    return this.props.id;
  }

  get title() {
    return this.props.title;
  }

  get key() {
    return this.props.key;
  }

  get icon() {
    return this.props.icon;
  }

  get iconClassName() {
    return this.props.iconClassName;
  }

  get process() {
    return this.props.process;
  }

  get status() {
    return this.props.status;
  }

  get command() {
    return this.props.command;
  }

  get output() {
    return this.props.output;
  }

  get sortOrder() {
    return this.props.sortOrder;
  }

  get updatedAt() {
    return new Date(this.props.updatedAt.getTime());
  }
}

function requireText(value: string, fieldName: string) {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${fieldName} cannot be empty.`);
  }

  return normalized;
}

export { SiteAnnouncement };
export type { SiteAnnouncementProps };
