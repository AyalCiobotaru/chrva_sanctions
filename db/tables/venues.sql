set nocount on;
go

if object_id(N'dbo.venues', N'U') is null
begin
  create table dbo.[venues] (
    [id] int identity(1,1) not null,
    [name] nchar(100) not null,
    [address] nchar(250) not null,
    [lat] float not null default ((0)),
    [lng] float not null default ((0))
  );
  print 'created dbo.venues';
end
else
  print 'exists dbo.venues';
go
