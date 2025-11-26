import enum


class TaskStatus(str, enum.Enum):
    Planned = "Planned"
    InProgress = "InProgress"
    Done = "Done"
    Blocked = "Blocked"
    Cancelled = "Cancelled"


class DepType(str, enum.Enum):
    FS = "FS"
    FF = "FF"
    SS = "SS"
    SF = "SF"


class ReviewStatus(str, enum.Enum):
    Pending = "Pending"
    Accepted = "Accepted"
    Rejected = "Rejected"


class CompletionRule(str, enum.Enum):
    AnyOne = "AnyOne"
    AllAssignees = "AllAssignees"


class InviteStatus(str, enum.Enum):
    Pending = "Pending"
    Accepted = "Accepted"
    Declined = "Declined"
