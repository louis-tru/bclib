// SPDX-License-Identifier: (GPL-2.0+ OR MIT)
pragma solidity ^0.7.0;

import {Primitive} from '../solidity/primitive.sol';

/**
 * 电子证照数据目录
 */
contract Licenses is Primitive {

	mapping(string=>uint256) name;

	struct License {
		uint256 create_time; // timestamp NOT NULL DEFAULT current_timestamp() COMMENT '创建时间', --'2019-08-13 09:59:59', 
		uint256 update_time; // timestamp NULL DEFAULT current_timestamp() COMMENT '修改时间',--'2019-10-24 12:36:13'
		string  certificate_identifier; // varchar(128) NOT NULL COMMENT '电子证照标识', --'1.2.156.3005.2.11100000000013338W032.11220000013544541J.2430599.001.F', 
		string  certificate_type_no; // varchar(64) NOT NULL COMMENT '证照类型编号', --'', 
		string  certificate_number; // varchar(128) NOT NULL COMMENT '证照编号', --'吉A042012000939', 
		string  certificate_name; // varchar(512) NOT NULL COMMENT '证照名称', --'建筑施工特种作业人员操作资格证书', 
		string  certificate_version; // varchar(32) NOT NULL COMMENT '证照版本号', --'001', 
		string  certificate_type_name; // varchar(256) NOT NULL COMMENT '证照类型名称', --'建筑施工特种作业人员操作资格证书', 
		string  certificate_type_name_code; // varchar(64) NOT NULL COMMENT '证照类型代码', --'11100000000013338W032', 
		string  certificate_issuing_authority_date; // varchar(32) NOT NULL COMMENT '证照颁发日期', --'20120109', 
		string  certificate_issuing_authority_name; // varchar(512) NOT NULL COMMENT '证照颁发机构名称', --'吉林省住房和城乡建设厅', 
		string  certificate_issuing_authority_code; // varchar(512) DEFAULT NULL, --'11220000013544541J', 
		string  certificate_define_authority_name; // varchar(256) DEFAULT NULL COMMENT '证照定义机构名称', --'中华人民共和国住房和城乡建设部', 
		string  certificate_define_authority_code; // varchar(32) DEFAULT NULL COMMENT '证照定义机构代码', --'11100000000013338W', 
		string  certificate_validate_start; // varchar(32) DEFAULT NULL COMMENT '证照有效期起始', --'20210108', 
		string  certificate_validate_end; // varchar(32) DEFAULT NULL COMMENT '证照有效期截至', --'20240108', 
		string  certificate_validity_range; // varchar(64) DEFAULT NULL COMMENT '证照有效期范围', --'2年', 
		string  certificate_area_code; // varchar(32) NOT NULL COMMENT '证照所属管辖属地编码', --'220000', 
		string  certificate_holder_name; // varchar(512) NOT NULL COMMENT '持证主体', --'李志国', 
		string  certificate_holder_code; // varchar(512) NOT NULL COMMENT '持证主体代码', --'13043419840726291X', 
		string  certificate_holder_type_name; // varchar(512) DEFAULT NULL COMMENT '持证主体代码类型名称', --'公民身份号码', 
		string  certificate_holder_type; // varchar(512) NOT NULL COMMENT '持证主体代码类型代码', --'111', 
		string  related_item_name; // varchar(256) DEFAULT NULL COMMENT '关联事项名称', --NULL, 
		string  related_item_code; // varchar(64) DEFAULT NULL COMMENT '关联事项代码', --'', 
		string  certificate_copy_creation_time; // varchar(32) DEFAULT NULL COMMENT '加注件制作时间', --'', 
		string  certificate_copy_creator; // varchar(256) DEFAULT NULL COMMENT '加注件制作者', --'',
		string  certificate_copy_cause; // varchar(256) DEFAULT NULL COMMENT '加注件制作事由', --'', 
		string  certificate_copy_expiring_time; // varchar(14) DEFAULT NULL COMMENT '加注件有效期截至时间', --'', 
		string  extend_info; // longtext DEFAULT NULL COMMENT '扩展业务信息', --'{}', 
		string  file_url; // varchar(256) NOT NULL COMMENT '证照文件URL', --'4f5eaedc48864920b484f35ec1dad57c.pdf', 
		string  status; // varchar(2) NOT NULL COMMENT '状态', --'U', 
	} 

}