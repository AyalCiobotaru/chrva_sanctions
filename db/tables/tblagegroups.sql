set nocount on;
go

if object_id(N'dbo.tblagegroups', N'U') is null
begin
  create table dbo.[tblagegroups] (
    [id] int identity(1,1) not null,
    [agegroup] nvarchar(50) null,
    [agedivision] int null,
    [grouping] nvarchar(50) null,
    [year] int null,
    constraint [PK_tblagegroups] primary key ([id])
  );
  print 'created dbo.tblagegroups';
end
else
  print 'exists dbo.tblagegroups';
go
