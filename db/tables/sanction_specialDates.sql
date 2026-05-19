set nocount on;
go

if object_id(N'dbo.sanction_specialDates', N'U') is null
begin
  create table dbo.[sanction_specialDates] (
    [id] int identity(1,1) not null,
    [week] int not null,
    [label] nvarchar(200) null,
    [notes] text null
  );
  print 'created dbo.sanction_specialDates';
end
else
  print 'exists dbo.sanction_specialDates';
go
