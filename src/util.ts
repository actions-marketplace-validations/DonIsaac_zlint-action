type IssueOpts = { title: string }
export const issueUrl = ({ title }: IssueOpts) =>
    `https://github.com/DonIsaac/zlint/issues/new?assignees=&labels=C-bug&projects=&template=bug_report.md&title=${title}`
