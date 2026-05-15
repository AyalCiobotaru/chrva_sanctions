set nocount on;
go

if object_id(N'dbo.clubcontacts', N'U') is null
begin
  create table dbo.[clubcontacts] (
    [ClubCode] nvarchar(5) not null,
    [ClubName] nvarchar(50) null,
    [contactFname] nvarchar(25) null,
    [contactLname] nvarchar(50) null,
    [straddress1] nvarchar(50) null,
    [straddress2] nvarchar(50) null,
    [city] nvarchar(30) null,
    [st] nvarchar(2) null,
    [zip] nvarchar(10) null,
    [phone1] nvarchar(15) null,
    [ext] nvarchar(7) null,
    [fax] nvarchar(15) null,
    [phone2] nvarchar(15) null,
    [club_web_page] nvarchar(100) null,
    [email] nvarchar(50) null,
    [altEmail] nvarchar(50) null,
    [comments] nvarchar(max) null,
    [grouping] nvarchar(50) null,
    [SSMA_TimeStamp] timestamp not null,
    [active] nchar(1) null default (N'Y'),
    [username] nvarchar(50) null,
    [password] nvarchar(15) null,
    [loginAttempts] int not null default ((0)),
    [lastlogin] smalldatetime null,
    [inAttendance] varchar(3) not null default ('No'),
    [clubType] nvarchar(50) null,
    [acknowledge] varchar(15) null,
    [inAttendance2021] varchar(3) null,
    [inAttendance2023] varchar(3) null,
    [inAttendance2024] varchar(3) null,
    constraint [PK_clubcontacts] primary key ([ClubCode])
  );
  print 'created dbo.clubcontacts';
end
else
  print 'exists dbo.clubcontacts';
go
