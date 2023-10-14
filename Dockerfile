#创建一个基于5.7.30版本的MySql
FROM mysql:5.7.30 

MAINTAINER don
EXPOSE 3306
LABEL version="0.1" description="Mysql服务器" by="don"

#设置免密登录
ENV MYSQL_ALLOW_EMPTY_PASSWORD yes

#将所需文件放到容器中
COPY /mysql/setup.sh /mysql/setup.sh #拷贝安装脚本
COPY /mysql/create_db.sql /mysql/create_db.sql #创建数据库
COPY /mysql/initial_data.sql /mysql/initial_data.sql #初始数据
COPY /mysql/privileges.sql /mysql/privileges.sql #设置密码和权限

#设置容器启动时执行的命令
CMD ["sh", "/mysql/setup.sh"]