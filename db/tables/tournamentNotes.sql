set nocount on;
go

if object_id(N'dbo.tournamentNotes', N'U') is null
begin
  create table dbo.[tournamentNotes] (
    [SanctionKey] nvarchar(50) not null,
    [Notes] nvarchar(max) null,
    [SSMA_TimeStamp] timestamp not null,
    constraint [PK_tournamentNotes] primary key ([SanctionKey])
  );
  print 'created dbo.tournamentNotes';
end
else
  print 'exists dbo.tournamentNotes';
go
