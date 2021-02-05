// SPDX-License-Identifier: (GPL-2.0+ OR MIT)
pragma solidity ^0.7.5;
pragma experimental ABIEncoderV2;

import {Primitive} from './primitive.sol';
import {Organizations} from './organizations.sol';

/**
 * 电子证照数据目录数据
 */
contract LicenseTypes is Primitive {

	struct LicenseType {
		string certificate_type_name; // varchar(256) NOT NULL COMMENT '证照类型名称', --'建筑施工特种作业人员操作资格证书', 
		string certificate_type_name_code; // varchar(64) NOT NULL COMMENT '证照类型代码', --'11100000000013338W032', 
		string certificate_define_authority_name; // varchar(256) DEFAULT NULL COMMENT '证照定义机构名称', --'中华人民共和国住房和城乡建设部', 
		string certificate_define_authority_code; // varchar(32) DEFAULT NULL COMMENT '证照定义机构代码', --'11100000000013338W', 
		string certificate_holder_type_name; // varchar(512) DEFAULT NULL COMMENT '持证主体代码类型名称', --'公民身份号码', 
		string[] shared_province; // 共享省份
	}

	Organizations private _org;

	mapping(uint256=>LicenseType) private _data;

	event onChange(LicenseType _type);

	constructor(Organizations org) payable {
		_org = org;
	}

	function _hash(string memory str) internal pure returns(uint256) {
		return uint256( keccak256(bytes(str)) );
	}

	/**
	 * 通过证照类型代码获取类型数据
	 */
	function get(string memory certificate_type_name_code) public view returns (LicenseType memory) {
		uint256 hash = _hash(certificate_type_name_code);
		return _data[hash];
	}

	/**
	 * 添加证照类型数据
	 */
	function set(
		string memory certificate_type_name_code,
		string memory certificate_type_name,
		string memory certificate_define_authority_name,
		string memory certificate_define_authority_code,
		string memory certificate_holder_type_name,
		string[] memory shared_province
	) public payable returns(bool) {
		require(_org.has(msg.sender)); // 只有机构账户可以写数据

		uint256 hash = _hash(certificate_type_name_code);
		LicenseType memory _type;

		_type.certificate_type_name = certificate_type_name;
		_type.certificate_type_name_code = certificate_type_name_code;
		_type.certificate_define_authority_name = certificate_define_authority_name;
		_type.certificate_define_authority_code = certificate_define_authority_code;
		_type.certificate_holder_type_name = certificate_holder_type_name;
		_type.shared_province = shared_province;

		_data[hash] = _type;

		emit onChange(_type);

		return true;
	}

}