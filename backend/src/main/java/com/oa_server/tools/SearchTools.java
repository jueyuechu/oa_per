package com.oa_server.tools;

import com.oa_server.module.admin.depts.entity.Dept;
import com.oa_server.module.admin.depts.service.AdminDeptService;
import com.oa_server.module.admin.jobs.entity.Job;
import com.oa_server.module.admin.jobs.service.AdminJobSService;
import com.oa_server.module.emp.entity.Emp;
import com.oa_server.module.emp.service.EmpService;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.List;

@RequiredArgsConstructor
@Component
public class SearchTools {

    private final AdminDeptService deptService;
    private final AdminJobSService jobService;
    private final EmpService empService;

    @Tool(description =" 查询所有部门")
    public List<Dept> queryDept(){
        return deptService.list();
    }

    @Tool(description = "查询所有工作")
    public List<Job> queryJob(){
        return jobService.list();
    }

    @Tool(description = "查询所有员工")
    public List<Emp> queryEmp(){
        return empService.list();
    }


}
