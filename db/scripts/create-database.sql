set nocount on;

if db_id(N'chrva_juniors_dev') is null
begin
  create database chrva_juniors_dev;
  print 'created database chrva_juniors_dev';
end
else
begin
  print 'database chrva_juniors_dev already exists';
end
go
